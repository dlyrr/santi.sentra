/// <reference types="vite/client" />

declare module "*.dds?url" {
  const url: string;
  export default url;
}
