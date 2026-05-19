/// <reference types="vite/client" />
declare global {
  interface Window {
    XLSX: any;
    electronAPI: any;
  }
}
export {};
