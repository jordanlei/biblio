// Links shared by the website's pages.
export const REPO_URL = "https://github.com/jordanlei/biblio";
export const BASE = import.meta.env.BASE_URL;
export const SETUP_URL = `${BASE}setup/`;
export const docUrl = (name: string) => `${REPO_URL}/blob/main/docs/${name}`;
