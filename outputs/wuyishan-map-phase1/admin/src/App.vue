<template>
 <header><div><strong>武夷山奶爸地图</strong><span>简单维护 · V0.2</span></div><nav class="actions main-admin-nav"><RouterLink to="/visitor-home">游客端维护</RouterLink><RouterLink to="/places">地点资料</RouterLink><RouterLink to="/map">内部地图</RouterLink><details><summary>更多维护</summary><div><RouterLink to="/visitor-content">内容列表</RouterLink><RouterLink to="/visitor-themes">批量主题归类</RouterLink><RouterLink to="/visitor-alerts">现场提醒</RouterLink><RouterLink to="/visitor-checks">内容检查</RouterLink><RouterLink to="/recycle">回收站</RouterLink></div></details></nav></header>
 <main><RouterView /></main>
</template>
