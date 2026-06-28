import { createRouter, createWebHistory } from 'vue-router'

import HomeView from './views/HomeView.vue'
import KioskoView from './views/KioskoView.vue'
import ImprimirView from './views/ImprimirView.vue'
import MaquinaView from './views/MaquinaView.vue'
import SubirImagenView from './views/SubirImagenView.vue'

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', component: HomeView },
  { path: '/kiosko', component: KioskoView },
  { path: '/imprimir', component: ImprimirView },
  { path: '/maquina', component: MaquinaView },
  { path: '/subir-imagen', component: SubirImagenView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
