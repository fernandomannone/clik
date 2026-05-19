import PocketBase from 'pocketbase';

export const BASE_URL = localStorage.getItem("pb_url") || ((window.location.hostname && window.location.hostname !== "localhost") ? `${window.location.protocol}//${window.location.hostname}:8090` : "http://127.0.0.1:8090");
export const pb = new PocketBase(BASE_URL);

// Habilitar el autoshore update
pb.authStore.onChange((token, model) => {
  console.log("Auth changed!");
});
