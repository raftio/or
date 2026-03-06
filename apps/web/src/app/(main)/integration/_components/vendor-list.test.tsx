import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { VendorConfig } from "./vendor-registry";
import { VendorList } from "./vendor-list";

vi.mock("./cicd-card", () => ({
  CicdCard: () => <div data-testid="cicd-card">CI/CD</div>,
}));

vi.mock("./git-provider-card", () => ({
  GitProviderCard: () => <div data-testid="git-provider-card">Git Provider</div>,
}));

function StubCard({ connected, onClick, detail, vendorId }: { connected: boolean; onClick: () => void; detail?: string; vendorId: string }) {
  return (
    <button data-testid={`card-${vendorId}`} data-connected={connected} data-detail={detail ?? ""} onClick={onClick}>
      {vendorId}
      {detail && <span data-testid={`detail-${vendorId}`}>{detail}</span>}
    </button>
  );
}

function makeVendor(
  id: string,
  integrationProvider?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describeConnection?: (integration: any) => string | undefined,
): VendorConfig {
  return {
    id,
    title: id,
    sourceType: "tasks",
    integrationProvider,
    cardComponent: ({ connected, onClick, detail }) => (
      <StubCard vendorId={id} connected={connected} onClick={onClick} detail={detail} />
    ),
    describeConnection,
  };
}

const vendorA = makeVendor("alpha", "alpha", (i) =>
  i?.config?.owner && i?.config?.repo ? `${i.config.owner}/${i.config.repo}` : undefined,
);
const vendorB = makeVendor("beta", "beta");
const vendorC = makeVendor("gamma");

describe("VendorList", () => {
  it("renders the Connected section when vendors are connected", () => {
    render(
      <VendorList
        vendors={[vendorA, vendorB, vendorC]}
        integrations={{ alpha: { id: "1" } }}
        onVendorClick={() => {}}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain("Connected");
    expect(headingTexts).toContain("Available");
  });

  it("does not render the Connected section when no vendors are connected", () => {
    render(
      <VendorList
        vendors={[vendorA, vendorC]}
        integrations={{}}
        onVendorClick={() => {}}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).not.toContain("Connected");
    expect(headingTexts).toContain("Available");
  });

  it("shows ALL vendors in the Available section, including connected ones", () => {
    render(
      <VendorList
        vendors={[vendorA, vendorB, vendorC]}
        integrations={{ alpha: { id: "1" }, beta: { id: "2" } }}
        onVendorClick={() => {}}
      />,
    );

    const availableSection = screen.getAllByRole("heading", { level: 2 })
      .find((h) => h.textContent === "Available")!
      .closest("section")!;

    expect(availableSection.querySelector('[data-testid="card-alpha"]')).toBeTruthy();
    expect(availableSection.querySelector('[data-testid="card-beta"]')).toBeTruthy();
    expect(availableSection.querySelector('[data-testid="card-gamma"]')).toBeTruthy();
  });

  it("Available section always shows cards as templates (connected=false, no detail)", () => {
    render(
      <VendorList
        vendors={[vendorA, vendorB, vendorC]}
        integrations={{ alpha: { id: "1", config: { owner: "raftio", repo: "or" } } }}
        onVendorClick={() => {}}
      />,
    );

    const availableSection = screen.getAllByRole("heading", { level: 2 })
      .find((h) => h.textContent === "Available")!
      .closest("section")!;

    const cards = availableSection.querySelectorAll("[data-testid^='card-']");
    cards.forEach((card) => {
      expect(card.getAttribute("data-connected")).toBe("false");
      expect(card.getAttribute("data-detail")).toBe("");
    });
  });

  it("calls onVendorClick with the correct vendor id", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <VendorList
        vendors={[vendorA, vendorB]}
        integrations={{}}
        onVendorClick={onClick}
      />,
    );

    const cards = screen.getAllByTestId("card-beta");
    await user.click(cards[0]);

    expect(onClick).toHaveBeenCalledWith("beta");
  });

  it("renders static CicdCard and GitProviderCard in the Available section", () => {
    render(
      <VendorList
        vendors={[vendorA]}
        integrations={{}}
        onVendorClick={() => {}}
      />,
    );

    expect(screen.getByTestId("cicd-card")).toBeTruthy();
    expect(screen.getByTestId("git-provider-card")).toBeTruthy();
  });

  it("shows connected vendors in both sections", () => {
    render(
      <VendorList
        vendors={[vendorA, vendorC]}
        integrations={{ alpha: { id: "1" } }}
        onVendorClick={() => {}}
      />,
    );

    const connectedSection = screen.getAllByRole("heading", { level: 2 })
      .find((h) => h.textContent === "Connected")!
      .closest("section")!;

    const availableSection = screen.getAllByRole("heading", { level: 2 })
      .find((h) => h.textContent === "Available")!
      .closest("section")!;

    expect(connectedSection.querySelector('[data-testid="card-alpha"]')).toBeTruthy();
    expect(availableSection.querySelector('[data-testid="card-alpha"]')).toBeTruthy();
  });

  it("passes connection detail to cards in the Connected section only", () => {
    render(
      <VendorList
        vendors={[vendorA, vendorB]}
        integrations={{
          alpha: { id: "1", config: { owner: "raftio", repo: "or" } },
          beta: { id: "2" },
        }}
        onVendorClick={() => {}}
      />,
    );

    const connectedSection = screen.getAllByRole("heading", { level: 2 })
      .find((h) => h.textContent === "Connected")!
      .closest("section")!;

    const alphaConnected = connectedSection.querySelector('[data-testid="card-alpha"]')!;
    expect(alphaConnected.getAttribute("data-detail")).toBe("raftio/or");

    const betaConnected = connectedSection.querySelector('[data-testid="card-beta"]')!;
    expect(betaConnected.getAttribute("data-detail")).toBe("");

    const availableSection = screen.getAllByRole("heading", { level: 2 })
      .find((h) => h.textContent === "Available")!
      .closest("section")!;

    const alphaAvailable = availableSection.querySelector('[data-testid="card-alpha"]')!;
    expect(alphaAvailable.getAttribute("data-detail")).toBe("");
  });
});
