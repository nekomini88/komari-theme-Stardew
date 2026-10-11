import { createRouter, createWebHistory } from 'vue-router'

/**
 * v2 路由（ART_SYSTEM 目标：功能面等价保留）
 *  /                → 首页（M1 占位，M2 实现节点卡片）
 *  /instance/:id    → 实例详情（M1 占位，M3 实现曲线/Ping）
 * 路由路径与名称与旧主题一致，保证外部链接与数据钩子不丢。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/v2/views/HomeView.vue'),
    },
    {
      path: '/instance/:id',
      name: 'instance-detail',
      component: () => import('@/v2/views/InstancePlaceholder.vue'),
    },
  ],
})

export default router
