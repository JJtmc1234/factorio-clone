local OUT = "jj-se-live-audit-v3.json"

local function safe(fn, fallback)
  local ok, value = pcall(fn)
  if ok then return value end
  return fallback
end

local function get_recipe(entity)
  return safe(function() return entity.get_recipe() end, nil)
end

local function status_name(entity)
  for name, value in pairs(defines.entity_status) do
    if value == entity.status then return name end
  end
  return tostring(entity.status)
end

local function is_natural_type(t)
  return t == "character" or t == "resource" or t == "tree" or t == "cliff"
    or t == "corpse" or t == "entity-ghost" or t == "tile-ghost"
    or t == "item-entity" or t == "particle" or t == "projectile"
    or t == "smoke" or t == "simple-entity"
    or t == "simple-entity-with-force" or t == "simple-entity-with-owner"
end

local function surface_state(surface, force)
  local built, by_name, generated, charted = 0, {}, 0, 0
  for _, entity in pairs(surface.find_entities_filtered{force = force}) do
    if entity.valid and not is_natural_type(entity.type) then
      built = built + 1
      by_name[entity.name] = (by_name[entity.name] or 0) + 1
    end
  end
  for chunk in surface.get_chunks() do
    generated = generated + 1
    if safe(function() return force.is_chunk_charted(surface, chunk) end, false) then
      charted = charted + 1
    end
  end
  return {
    name = surface.name,
    index = surface.index,
    player_built_entities = built,
    player_entity_names = by_name,
    generated_chunks = generated,
    charted_chunks = charted,
    character_entities = #surface.find_entities_filtered{type = "character", force = force}
  }
end

local function point_in_box(point, box, margin)
  margin = margin or 0
  return point.x >= box.left_top.x - margin
    and point.x <= box.right_bottom.x + margin
    and point.y >= box.left_top.y - margin
    and point.y <= box.right_bottom.y + margin
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
      and point_in_box(pickup, box, 0.4)
      and not point_in_box(drop, box, 0.4)
    then
      count = count + 1
    end
  end
  return count
end

local function nearby_logistics(machine)
  local p = machine.position
  local area = {{p.x - 7, p.y - 7}, {p.x + 7, p.y + 7}}
  local entity_types = {
    "inserter", "loader", "loader-1x1", "transport-belt",
    "underground-belt", "splitter", "container", "logistic-container",
    "pipe", "pipe-to-ground", "pump"
  }
  local total, by_type = 0, {}
  for _, entity_type in pairs(entity_types) do
    local n = #machine.surface.find_entities_filtered{
      area = area,
      type = entity_type,
      force = machine.force
    }
    by_type[entity_type] = n
    total = total + n
  end
  local network = safe(function()
    return machine.surface.find_logistic_network_by_position(machine.position, machine.force)
  end, nil)
  return {total = total, by_type = by_type, logistic_network = network ~= nil}
end

local function stat_count(stats, method, item_name)
  if not stats then return nil end
  local value = safe(function() return stats[method](item_name) end, nil)
  if value ~= nil then return value end
  return safe(function()
    return stats[method]({name = item_name, quality = "normal"})
  end, nil)
end

local function count_item_in_storage(surface, force, item_name)
  if not prototypes.item[item_name] then return 0 end
  local total = 0
  for _, entity in pairs(surface.find_entities_filtered{
    type = {"container", "logistic-container", "cargo-wagon"},
    force = force
  }) do
    local inventory = safe(function()
      return entity.get_inventory(defines.inventory.chest)
        or entity.get_inventory(defines.inventory.cargo_wagon)
    end, nil)
    if inventory and inventory.valid then
      total = total + safe(function() return inventory.get_item_count(item_name) end, 0)
    end
  end
  return total
end

local function audit()
  local force = game.forces.player
  local nauvis = game.surfaces["Nauvis"] or game.surfaces["nauvis"] or game.surfaces[1]
  local active = script.active_mods
  local report = {
    tick = game.tick,
    factorio_version = active.base,
    space_exploration_version = active["space-exploration"],
    krastorio2_version = active.Krastorio2,
    active_mods = active,
    technologies = {},
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
    launch_support = {
      satellite_telemetry_lifetime_produced = nil,
      launch_pads_on_nauvis = 0,
      landing_pads_on_nauvis = 0,
      cargo_rocket_sections_in_storage = 0,
      space_capsules_in_storage = 0
    },
    non_nauvis_surfaces = {},
    orbit_like_surfaces = {}
  }

  if not nauvis then
    report.error = "Nauvis surface not found"
    helpers.write_file(OUT, helpers.table_to_json(report), false)
    return
  end

  local technology_names = {
    "se-rocket-science-pack",
    "se-rocket-launch-pad",
    "space-science-pack",
    "se-space-science-lab",
    "se-space-platform-scaffold"
  }
  for _, name in pairs(technology_names) do
    local technology = force.technologies[name]
    report.technologies[name] = technology and technology.researched or false
  end
  report.rocket_science.researched = report.technologies["se-rocket-science-pack"]

  local stats = safe(function() return force.get_item_production_statistics(nauvis) end, nil)
  report.rocket_science.lifetime_produced = stat_count(stats, "get_input_count", "se-rocket-science-pack")
  report.rocket_science.lifetime_consumed = stat_count(stats, "get_output_count", "se-rocket-science-pack")
  report.launch_support.satellite_telemetry_lifetime_produced = stat_count(stats, "get_input_count", "se-satellite-telemetry")

  local product_producers = {}
  for _, entity in pairs(nauvis.find_entities_filtered{
    type = {"assembling-machine", "furnace", "rocket-silo"},
    force = force
  }) do
    local recipe = get_recipe(entity)
    if recipe then
      for _, product in pairs(recipe.products or {}) do
        if product.name then
          product_producers[product.name] = (product_producers[product.name] or 0) + 1
        end
      end
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
      report.rocket_science.upstream_total_count = report.rocket_science.upstream_total_count + 1
      if producer_count > 0 then
        report.rocket_science.upstream_automated_count = report.rocket_science.upstream_automated_count + 1
      end
    end
  end

  for _, machine in pairs(nauvis.find_entities_filtered{
    type = "assembling-machine",
    force = force
  }) do
    local recipe = get_recipe(machine)
    if recipe and recipe.name == "se-rocket-science-pack" then
      local outputs = output_inserter_count(machine)
      local logistics = nearby_logistics(machine)
      local has_output = outputs > 0
        or (logistics.by_type.loader or 0) > 0
        or (logistics.by_type["loader-1x1"] or 0) > 0
        or logistics.logistic_network
      local has_logistics = logistics.total >= 4 or logistics.logistic_network
      local speed = machine.crafting_speed or 0

      report.rocket_science.count = report.rocket_science.count + 1
      report.rocket_science.total_crafting_speed = report.rocket_science.total_crafting_speed + speed
      report.rocket_science.estimated_packs_per_second_before_productivity =
        report.rocket_science.estimated_packs_per_second_before_productivity + speed * 8 / 80
      if machine.status == defines.entity_status.working then
        report.rocket_science.working_now = report.rocket_science.working_now + 1
      end
      if has_output then
        report.rocket_science.machines_with_automatic_output =
          report.rocket_science.machines_with_automatic_output + 1
      end
      if has_logistics then
        report.rocket_science.machines_with_logistics =
          report.rocket_science.machines_with_logistics + 1
      end
      table.insert(report.rocket_science.machines, {
        name = machine.name,
        unit_number = machine.unit_number,
        position = {x = machine.position.x, y = machine.position.y},
        status = status_name(machine),
        crafting_speed = speed,
        productivity_bonus = machine.productivity_bonus,
        output_inserters = outputs,
        nearby_logistics = logistics,
        has_automatic_output = has_output,
        has_logistics = has_logistics
      })
    end
  end

  if report.rocket_science.upstream_total_count > 0 then
    report.rocket_science.upstream_automation_fraction =
      report.rocket_science.upstream_automated_count / report.rocket_science.upstream_total_count
  end

  if prototypes.entity["se-rocket-launch-pad"] then
    report.launch_support.launch_pads_on_nauvis =
      #nauvis.find_entities_filtered{name = "se-rocket-launch-pad", force = force}
  end
  if prototypes.entity["se-rocket-landing-pad"] then
    report.launch_support.landing_pads_on_nauvis =
      #nauvis.find_entities_filtered{name = "se-rocket-landing-pad", force = force}
  end
  report.launch_support.cargo_rocket_sections_in_storage =
    count_item_in_storage(nauvis, force, "se-cargo-rocket-section")
  report.launch_support.space_capsules_in_storage =
    count_item_in_storage(nauvis, force, "se-space-capsule")

  local orbit_untouched = true
  for _, surface in pairs(game.surfaces) do
    if surface.index ~= nauvis.index then
      local entry = surface_state(surface, force)
      table.insert(report.non_nauvis_surfaces, entry)
      local lower = string.lower(surface.name)
      if string.find(lower, "orbit", 1, true)
        or string.find(lower, "asteroid", 1, true)
        or string.find(lower, "space", 1, true)
      then
        table.insert(report.orbit_like_surfaces, entry)
        if entry.player_built_entities > 0
          or entry.charted_chunks > 0
          or entry.character_entities > 0
        then
          orbit_untouched = false
        end
      end
    end
  end

  report.orbit_untouched_heuristic_pass = orbit_untouched
  report.full_scale_machine_heuristic_pass =
    report.rocket_science.count >= 4
    and report.rocket_science.machines_with_automatic_output >= 3
    and report.rocket_science.machines_with_logistics >= 3
    and report.rocket_science.upstream_automation_fraction >= 0.75
  report.full_scale_throughput_heuristic_pass =
    report.rocket_science.estimated_packs_per_second_before_productivity >= 0.5
    and report.rocket_science.machines_with_automatic_output >= 1
    and report.rocket_science.machines_with_logistics >= 1
    and report.rocket_science.upstream_automation_fraction >= 0.75

  helpers.write_file(OUT, helpers.table_to_json(report), false)
end

local target_tick = nil
script.on_init(function() target_tick = game.tick + 120 end)
script.on_configuration_changed(function() target_tick = game.tick + 120 end)
script.on_event(defines.events.on_tick, function(event)
  if target_tick and event.tick >= target_tick then
    target_tick = nil
    audit()
  end
end)
