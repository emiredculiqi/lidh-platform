export type DemoPresetPage = {
  url: string;
  title: string;
  text: string;
};

export type DemoPresetCompany = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  currency?: string;
  facebook?: string;
  instagram?: string;
};

export type DemoPreset = {
  slug: string;
  origin: string;
  locale: "al" | "en";
  company: DemoPresetCompany;
  welcome: { al: string; en: string };
  pages: DemoPresetPage[];
};
