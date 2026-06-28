import { Meteor } from 'meteor/meteor'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '../../client/main.css'

Meteor.startup(() => {
  const app = createApp(App)
  app.use(router)
  app.mount('#app')
})
