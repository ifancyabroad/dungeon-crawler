import ky from "ky";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const api = ky.create({ prefixUrl: API_BASE });
