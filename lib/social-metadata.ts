import { pacificDate } from "./pacific-time";

export function rootSocialPreview(now = new Date()): {
  title: string;
  description: string;
  image: string;
} {
  const date = pacificDate(now);

  return {
    title: "Today's Pink Door Poll",
    description:
      "Choose tonight's verified observance theme before 5:50 PM Pacific.",
    image: `/api/share/poll/${date}/image?v=${date}`,
  };
}
