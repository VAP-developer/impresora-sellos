"use strict";
const electron = require("electron");
const api = {
  config: {
    get: () => electron.ipcRenderer.invoke("config:get"),
    updateMaquina: (data) => electron.ipcRenderer.invoke("config:updateMaquina", data),
    updateImprimir: (data) => electron.ipcRenderer.invoke("config:updateImprimir", data),
    updateSesion: () => electron.ipcRenderer.invoke("config:updateSesion"),
    updateSesionError: () => electron.ipcRenderer.invoke("config:updateSesionError"),
    updateRollos: (sellos1, sellos2, tickets) => electron.ipcRenderer.invoke("config:updateRollos", sellos1, sellos2, tickets),
    updateRollosRevert: (sellos1, sellos2, tickets) => electron.ipcRenderer.invoke("config:updateRollosRevert", sellos1, sellos2, tickets),
    initConfig: () => electron.ipcRenderer.invoke("config:initConfig"),
    onChange: (callback) => {
      const handler = (_event, config) => {
        callback(config);
      };
      electron.ipcRenderer.on("config:changed", handler);
      return () => {
        electron.ipcRenderer.removeListener("config:changed", handler);
      };
    }
  },
  orders: {
    insert: (orders) => electron.ipcRenderer.invoke("orders:insert", orders),
    downloadCSV: () => electron.ipcRenderer.invoke("orders:downloadCSV")
  },
  images: {
    upload: (name, dataUri, type, size) => electron.ipcRenderer.invoke("images:upload", name, dataUri, type, size),
    remove: (name) => electron.ipcRenderer.invoke("images:remove", name),
    getByName: (name) => electron.ipcRenderer.invoke("images:getByName", name)
  },
  printer: {
    getStatus: () => electron.ipcRenderer.invoke("printer:getStatus"),
    print: (config, quantities, profile) => electron.ipcRenderer.invoke("printer:print", config, quantities, profile),
    pause: () => electron.ipcRenderer.invoke("printer:pause"),
    resume: () => electron.ipcRenderer.invoke("printer:resume"),
    getQueue: () => electron.ipcRenderer.invoke("printer:getQueue")
  },
  sync: {
    getStatus: () => electron.ipcRenderer.invoke("sync:getStatus"),
    triggerSync: () => electron.ipcRenderer.invoke("sync:triggerSync")
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electronAPI", api);
  } catch (error) {
    console.error("Failed to expose electronAPI via contextBridge:", error);
  }
} else {
  window.electronAPI = api;
}
