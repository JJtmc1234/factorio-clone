local AUDIT_FILE = "jj-se-live-audit.json"

local function safe(fn, fallback)
  local ok, value = pcall(fn)
  if ok then return value end
  return fallback
end

local function write_json(value)
  local text = helpers.table_to_json(value)
  helpers.write_file(AUDIT_FILE, text, false)
end

local function point_in_box(point, box, margin)
  margin = margin or 0
  return point.x >= box.left_top.x - margin
    and point.x <= box.right_bottom.x + margin
    and point.y >= box.left_top.y - margin
    and point.y <= box.right_bottom.y + margin
end

local function get_recipe(entity)
  return safe(function() return entity.get_recipe() end, nil)
end

local function recipe_products(recipe)
  local products = {}
  if not recipe then return products end
  for _, product in pairs(recipe.products or {}) do
    if product.name then products[product.name] = true end
  end
  return products
end

local function entity_status_name(entity)
  for name, value in pairs(defines.entity_status) do
    if value == entity.status then return name end
  end
  return tostring(entity.status)
end

local function output_inserter_count(machine)
  local box = machine.bounding_box
  local area = {
    {box.left_top.x - 4, box.left_top.y - 4},
    {box.right_bottom.x + 4, box.right_bottom.y + 4}
  }
  local count = 0
  for _, inserter in pairs(machine.surface.find_entities_filtered{
    area = area,
    type = "inserter",
    force = machine.force
  }) do
    local pickup = safe(function() return inserter.pickup_position end, nil)
    local drop = safe(function() return inserter.drop_position end, nil)
    if pickup and drop
      and point_in_box(pickup, box, 0.35)
      and not point_in_box(drop, box, 0.35)
    then
      count = count + 1
    end
  end
  return count
end

local function nearby_logistics(machine)
  local p = machine.position
  local area = {{p.x - 7, p.y - 7}, {p.x + 7, p.y + 7}}
  local types = {
    "inserter", "loader", "loader-1x1", "transport-belt",
    "underground-belt", "splitter", "container", "logistic-container",
    "pipe", "pipe-to-ground", "pump"
  }
  local by_type, total = {}, 0
  for _, entity_type in pairs(types) do
    local count = #machine.surface.find_entities_filtered{
      area = area,
      type = entity_type,
      force = machine.force
    }
    by_type[entity_type] = count
    total = total + count
  end
  local network = safe(function()
    return machine.surface.find_logistic_network_by_position(machine.position, machine.force)
  end, nil)
  return {
    total = total,
    by_type = by_type,
    covered_by_logistic_network = network ~= nil
  }
end

local IGNORED_ENTITY_TYPES = {
  character = true,
  resource = true,
  tree = true,
  cliff = true,
  corpse = true,
  ["entity-ghost"] = true,
  ["tile-ghost"] = true,
  ["item-entity"] = true,
  particle = true,
  projectile = true,
  smoke = true,
  ["simple-entity"] = true,
  ["simple-entity-with-force"] = true,
  ["simple-entity-with-owner"] = true
}

local function built_entities(surface, force)
  local count, by_type, by_name = 0, {}, {}
  for _, entity in pairs(surface.find_entities_filtered{force = force}) do
    if entity.valid and not IGNORED_ENTITY_TYPES[entity.type] then
      count = count + 1
      by_type[entity.type] = (by_type[entity.type] or 0) + 1
      by_name[entity.name] = (by_name[entity.name] or 0) + 1
    end
  end
  return count, by_type, by_name
end

local function chunk_state(surface, force)
  local generated, charted = 0, 0
  for chunk in surface.get_chunks() do
    generated = generated + 1
    if safe(function() return force.is_chunk_charted(surface, chunk) end, false) then
      charted = charted + 1
    end
  end
  return generated, charted
end

local function item_stat(stats, method, item_name)
  if not stats then return nil end
  local value = safe(function() return stats[method](item_name) end, nil)
  if value ~= nil then return value end
  return safe(function()
    return stats[method]({name = item_name, quality = "normal"})
  end, nil)
end

local function run_audit()
  local force = game.forces.player
  local nauvis = game.surfaces["Nauvis"] or game.surfaces["nauvis"] or game.surfaces[1]
  local active = script.active_mods
  local report = {
    generated_at_tick = game.tick,
    factorio_version = active.base,
    space_exploration_version = active["space-exploration"],
    krastorio_2_version = active.Krastorio2,
    active_mods = active,
    nauvis_surface = nauvis and nauvis.name or nil,
    rocket_science = {
      researched = false,
      lifetime_produced = nil,
      lifetime_consumed = nil,
      machines = {},
      count = 0,
      working_now = 0,
      total_crafting_speed = 0,
      estimated_packs_per_second_before_productivity = 0,
      machines_with_automatic_output = 0,
      machines_with_logistics = 0,
      upstream_ingredients = {},
      upstream_automated_count = 0,
      upstream_total_count = 0,
      upstream_automation_fraction = 0
    },
    cargo_rocket = {
      launch_pads_on_nauvis = 0,
      landing_pads_on_nauvis = 0,
      cargo_sections_in_storage = 0
    },
    non_nauvis_surfaces = {},
    orbit_like_surfaces = {},
    acceptance_rule = {
      minimum_rocket_science_machines = 4,
      minimum_machines_with_automatic_output = 3,
      minimum_machines_with_logistics = 3,
      minimum_upstream_ingredient_coverage = 0.75,
      note = "A technology unlock or one isolated assembler is not full-scale automation."
    }
  }

  if not nauvis then
    report.error = "Nauvis surface not found"
    write_json(report)
    return
  end

  local technology = force.technologies["se-rocket-science-pack"]
  report.rocket_science.researched = technology and technology.researched or false

  local statistics = safe(function()
    return force.get_item_production_statistics(nauvis)
  end, nil)
  report.rocket_science.lifetime_produced = item_stat(
    statistics, "get_input_count", "se-rocket-science-pack"
  )
  report.rocket_science.lifetime_consumed = item_stat(
    statistics, "get_output_count", "se-rocket-science-pack"
  )

  local all_crafters = nauvis.find_entities_filtered{
    type = {"assembling-machine", "furnace", "rocket-silo"},
    force = force
  }
  local product_producers = {}
  for _, entity in pairs(all_crafters) do
    for product_name, _ in pairs(recipe_products(get_recipe(entity))) do
      product_producers[product_name] = (product_producers[product_name] or 0) + 1
    end
  end

  local rocket_recipe = prototypes.recipe["se-rocket-science-pack"]
  if rocket_recipe then
    for _, ingredient in pairs(rocket_recipe.ingredients or {}) do
      local producer_count = product_producers[ingredient.name] or 0
      report.rocket_science.upstream_ingredients[ingredient.name] = {
        producer_machines = producer_count,
        automated = producer_count > 0
      }
      report.rocket_science.upstream_total_count =
        report.rocket_science.upstream_total_count + 1
      if producer_count > 0 then
        report.rocket_science.upstream_automated_count =
          report.rocket_science.upstream_automated_count + 1
      end
    end
  end

  for _, machine in pairs(nauvis.find_entities_filtered{
    type = "assembling-machine",
    force = force
  }) do
    local recipe = get_recipe(machine)
    if recipe and recipe.name == "se-rocket-science-pack" then
      local logistics = nearby_logistics(machine)
      local outputs = output_inserter_count(machine)
      local has_logistics = logistics.total >= 4
        or logistics.covered_by_logistic_network
      local has_output = outputs > 0
        or (logistics.by_type.loader or 0) > 0
        or (logistics.by_type["loader-1x1"] or 0) > 0
        or logistics.covered_by_logistic_network

      report.rocket_science.count = report.rocket_science.count + 1
      report.rocket_science.total_crafting_speed =
        report.rocket_science.total_crafting_speed + (machine.crafting_speed or 0)
      report.rocket_science.estimated_packs_per_second_before_productivity =
        report.rocket_science.estimated_packs_per_second_before_productivity
        + ((machine.crafting_speed or 0) * 8 / 80)
      if machine.status == defines.entity_status.working then
        report.rocket_science.working_now = report.rocket_science.working_now + 1
      end
      if has_logistics then
        report.rocket_science.machines_with_logistics =
          report.rocket_science.machines_with_logistics + 1
      end
      if has_output then
        report.rocket_science.machines_with_automatic_output =
          report.rocket_science.machines_with_automatic_output + 1
      end

      table.insert(report.rocket_science.machines, {
        unit_number = machine.unit_number,
        name = machine.name,
        position = {x = machine.position.x, y = machine.position.y},
        status = entity_status_name(machine),
        crafting_speed = machine.crafting_speed,
        productivity_bonus = machine.productivity_bonus,
        output_inserters = outputs,
        nearby_logistics = logistics,
        has_logistics = has_logistics,
        has_automatic_output = has_output
      })
    end
  end

  report.cargo_rocket.launch_pads_on_nauvis =
    #nauvis.find_entities_filtered{name = "se-rocket-launch-pad", force = force}
  report.cargo_rocket.landing_pads_on_nauvis =
    #nauvis.find_entities_filtered{name = "se-rocket-landing-pad", force = force}

  if prototypes.item["se-cargo-rocket-section"] then
    for _, entity in pairs(nauvis.find_entities_filtered{
      type = {"container", "logistic-container", "cargo-wagon"},
      force = force
    }) do
      local inventory = safe(function()
        return entity.get_inventory(defines.inventory.chest)
          or entity.get_inventory(defines.inventory.cargo_wagon)
      end, nil)
      if inventory and inventory.valid then
        report.cargo_rocket.cargo_sections_in_storage =
          report.cargo_rocket.cargo_sections_in_storage
          + safe(function()
              return inventory.get_item_count("se-cargo-rocket-section")
            end, 0)
      end
    end
  end

  for _, surface in pairs(game.surfaces) do
    if surface.index ~= nauvis.index then
      local built_count, by_type, by_name = built_entities(surface, force)
      local generated_chunks, charted_chunks = chunk_state(surface, force)
      local entry = {
        name = surface.name,
        index = surface.index,
        player_built_entities = built_count,
        player_entity_types = by_type,
        player_entity_names = by_name,
        generated_chunks = generated_chunks,
        charted_chunks = charted_chunks,
        players_present = #surface.players
      }
      table.insert(report.non_nauvis_surfaces, entry)
      local lower = string.lower(surface.name)
      if string.find(lower, "orbit", 1, true)
        or string.find(lower, "asteroid", 1, true)
        or string.find(lower, "space", 1, true)
      then
        table.insert(report.orbit_like_surfaces, entry)
      end
    end
  end

  if report.rocket_science.upstream_total_count > 0 then
    report.rocket_science.upstream_automation_fraction =
      report.rocket_science.upstream_automated_count
      / report.rocket_science.upstream_total_count
  end

  report.full_scale_heuristic_pass =
    report.rocket_science.count >= 4
    and report.rocket_science.machines_with_automatic_output >= 3
    and report.rocket_science.machines_with_logistics >= 3
    and report.rocket_science.upstream_automation_fraction >= 0.75

  local orbit_clean = true
  for _, entry in pairs(report.orbit_like_surfaces) do
    if entry.player_built_entities > 0 or entry.charted_chunks > 0 then
      orbit_clean = false
    end
  end
  report.orbit_untouched_heuristic_pass = orbit_clean

  write_json(report)
  game.print("JJ SE live audit written to script-output/" .. AUDIT_FILE)
end

local scheduled_tick = nil

script.on_init(function()
  scheduled_tick = game.tick + 120
end)

script.on_configuration_changed(function()
  scheduled_tick = game.tick + 120
end)

script.on_event(defines.events.on_tick, function(event)
  if scheduled_tick and event.tick >= scheduled_tick then
    scheduled_tick = nil
    run_audit()
  end
end)

if not commands.commands["jj-se-audit"] then
  commands.add_command(
    "jj-se-audit",
    "Audit Rocket Science automation and orbital development.",
    function() run_audit() end
  )
end
