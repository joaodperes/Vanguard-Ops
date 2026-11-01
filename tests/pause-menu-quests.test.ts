import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InGameMenu } from "../src/components/game/InGameMenu";
import { QuestSections, type ChallengeView, type WeeklyChallengeView } from "../src/components/game/QuestPanel";

const daily: ChallengeView[] = [{
  challengeId: "daily_sample", title: "Daily Target", description: "Eliminate opponents",
  icon: "target", goal: 10, progress: 6, completed: false, awarded: false,
  rewardXp: 100, rewardCredits: 40,
}];
const weekly: WeeklyChallengeView[] = [{
  challengeId: "weekly_sample", title: "Weekly Elite", description: "Complete matches",
  icon: "star", weekKey: "2026-W44", goal: 5, progress: 5, completed: true,
  awarded: true, isElite: true, rewardXp: 350, rewardCredits: 75,
}];

test("pause menu provides quests and removes the simulation warning", () => {
  const html = renderToStaticMarkup(createElement(InGameMenu, {
    page: "main", onPageChange: () => {}, onResume: () => {},
    onQuit: () => {}, onLoadoutSaved: () => {}, online: true, mode: "tdm",
  }));
  expect(html).toContain("Quests");
  expect(html).toContain("Daily and weekly challenges");
  expect((html.match(/>Resume</g) ?? [])).toHaveLength(1);
  expect(html).not.toContain("Return to the match");
  expect(html).not.toContain("Match simulation continues");
  expect(html).not.toContain("other players are not paused");
});

test("loadout receives the wide container and quests a readable container", () => {
  const props = { onPageChange: () => {}, onResume: () => {}, onQuit: () => {},
    onLoadoutSaved: () => {}, online: false, mode: "tdm" as const };
  const loadoutHtml = renderToStaticMarkup(createElement(InGameMenu, { ...props, page: "loadout" }));
  expect(loadoutHtml).toContain("max-w-7xl");
  const questHtml = renderToStaticMarkup(createElement(InGameMenu, { ...props, page: "quests" }));
  expect(questHtml).toContain("max-w-5xl");
  expect(questHtml).toContain("Loading quests");
  expect(questHtml).not.toContain("Refresh");
});

test("daily, weekly and elite objectives show progress and rewards", () => {
  const html = renderToStaticMarkup(createElement(QuestSections, { daily, weekly }));
  expect(html).toContain("Daily Challenges");
  expect(html).toContain("Weekly Challenges");
  expect(html).toContain("Daily Target");
  expect(html).toContain("Weekly Elite");
  expect(html).toContain("Elite Active");
  expect(html).toContain("6 / 10");
  expect(html).toContain("5 / 5");
  expect(html).toContain("350 XP");
  expect(html).toContain("75 CR");
});
