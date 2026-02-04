const routes = [
  {
    path: '/',
    component: () => import('layouts/PublicLayout.vue'),
    meta: {
      public: true,
      title: 'Login',
    },
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('pages/IndexPage.vue'),
      },
    ],
  },
  {
    path: '/user',
    component: () => import('layouts/MainLayout.vue'),
    meta: {
      auth: true,
      roles: ['ADMIN', 'USER'],
      title: 'User',
    },
    children: [
      {
        path: '',
        name: 'queueStats',
        component: () => import('pages/QueueStatsPage.vue'),
      },
      {
        path: 'queue/:queueName',
        name: 'queue',
        component: () => import('pages/QueuePage.vue'),
      },
      {
        path: 'unificador-contactos',
        name: 'unificadorContactos',
        component: () => import('pages/UnificadorContactosPage.vue'),
      },
      {
        path: 'unificador-empresas',
        name: 'unificadorEmpresas',
        component: () => import('pages/UnificadorEmpresasPage.vue'),
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('layouts/MainLayout.vue'),
    meta: {
      auth: true,
      roles: ['ADMIN'],
      title: 'Admin',
    },
    children: [
      {
        path: '',
        name: 'admin',
        component: () => import('pages/AdminPage.vue'),
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
