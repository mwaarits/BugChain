import { expect, test, type Page } from "@playwright/test";

const bounties = [
  { bountyId: 2, scopeHash: `0x${"22".repeat(32)}`, scope: "In scope:\n- API authentication\n- Escrow contract", escrowWei: "2000000000000000000", deadline: 2_000_000_000, business: `0x${"bb".repeat(20)}`, state: "Closed", inDispute: false, disputeRequested: false, firstSubmissionTs: null, confirmation: "confirmed" },
  { bountyId: 1, scopeHash: `0x${"11".repeat(32)}`, scope: "Active scope", escrowWei: "1000000000000000000", deadline: 2_000_000_000, business: `0x${"aa".repeat(20)}`, state: "Active", inDispute: false, disputeRequested: false, firstSubmissionTs: null, confirmation: "confirmed" }
];

async function installWalletAndApi(page: Page) {
  await page.addInitScript(() => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const provider = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [`0x${"12".repeat(20)}`];
        if (method === "eth_chainId") return "0x3c8";
        if (method === "wallet_switchEthereumChain") return null;
        return null;
      },
      on: (event: string, listener: (...args: unknown[]) => void) => {
        const group = listeners.get(event) ?? new Set();
        group.add(listener);
        listeners.set(event, group);
      },
      removeListener: (event: string, listener: (...args: unknown[]) => void) => listeners.get(event)?.delete(listener)
    };
    Object.defineProperty(window, "ethereum", { value: provider });
  });
  await page.route("**/api/bounties", (route) => route.fulfill({ json: { bounties } }));
  await page.route("**/api/bounties/*", (route) => route.fulfill({ json: { ...bounties[0], submissions: [] } }));
  await page.route("**/api/submissions**", (route) => route.fulfill({ json: { submissions: [] } }));
}

test("CTA, modal deep link, automatic bounty selection, and responsive badges", async ({ page }) => {
  await installWalletAndApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "EXPLORE BOUNTIES" }).click();
  await expect(page).toHaveURL(/\/app\/bounties$/);
  await page.getByRole("button", { name: "Connect wallet" }).click();

  const cards = page.locator('[data-testid^="bounty-card-"]');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute("data-testid", "bounty-card-1");
  await expect(page.getByTestId("bounty-card-2")).toHaveClass(/opacity-50/);

  await page.getByTestId("bounty-card-1").getByText("Bounty #1").click();
  await expect(page).toHaveURL(/\/app\/bounties\/1$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close bounty details" }).click();

  await page.getByTestId("bounty-card-1").getByRole("button", { name: /Submit finding/ }).click();
  await expect(page.getByLabel("Bounty ID")).toHaveValue("1");

  await page.setViewportSize({ width: 390, height: 844 });
  const badge = page.getByTestId("bounty-card-1").getByText("confirmed", { exact: true });
  await expect(badge).toBeVisible();
  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});
