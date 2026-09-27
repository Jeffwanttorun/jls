import { createApp } from 'vue';
import { createRouter,createWebHistory } from 'vue-router';
import App from './App.vue';
import Places from './Places.vue';
import PlaceDetail from './PlaceDetail.vue';
import InternalMap from './InternalMap.vue';
import RecycleBin from './RecycleBin.vue';
import VisitorContentList from './VisitorContentList.vue';
import VisitorContentEditor from './VisitorContentEditor.vue';
import VisitorThemes from './VisitorThemes.vue';
import VisitorAlerts from './VisitorAlerts.vue';
import VisitorChecks from './VisitorChecks.vue';
import VisitorHomeEditor from './VisitorHomeEditor.vue';
import './style.css';
// Remove the obsolete credential left by the previous release.
try { sessionStorage.removeItem('adminToken'); } catch { /* Storage is optional. */ }
const base=import.meta.env.BASE_URL;
const router=createRouter({history:createWebHistory(base),routes:[{path:'/',redirect:'/visitor-home'},{path:'/places',component:Places},{path:'/places/:code',component:PlaceDetail},{path:'/map',component:InternalMap},{path:'/recycle',component:RecycleBin},{path:'/visitor-home',component:VisitorHomeEditor},{path:'/visitor-content',component:VisitorContentList},{path:'/visitor-content/:id',component:VisitorContentEditor},{path:'/visitor-themes',component:VisitorThemes},{path:'/visitor-alerts',component:VisitorAlerts},{path:'/visitor-checks',component:VisitorChecks}]});
createApp(App).use(router).mount('#app');
