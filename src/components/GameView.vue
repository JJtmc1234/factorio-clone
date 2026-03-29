<template>
    <canvas ref="canvas"></canvas>
  </template>
  
  <script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { startGame } from '../game/loop'
  
  const canvas = ref<HTMLCanvasElement | null>(null)
  
  onMounted(() => {
    if (!canvas.value) return
  
    const ctx = canvas.value.getContext('2d')
    if (!ctx) return
  
    canvas.value.width = window.innerWidth
    canvas.value.height = window.innerHeight
  
    startGame(canvas.value, ctx)
  })
  </script>
  
  <style scoped>
  canvas {
    display: block;
  }
  </style>