// @vitest-environment jsdom
//
// Keyboard navigation regression test for CommandSelect (cmdk inside a
// Radix dialog): ArrowDown/ArrowUp must move the highlighted option and
// Enter must select it. Written without JSX so it runs under the project's
// `jsx: preserve` tsconfig.

import { describe, it, expect, vi, beforeAll } from "vitest";
import { createElement as h } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CommandSelect } from "./command-select";

beforeAll(() => {
  // jsdom lacks these browser APIs used by cmdk / Radix / our useIsMobile.
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, // desktop → Dialog path, not the vaul Drawer
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const options = [
  { id: "a1", value: "a1", children: h("span", null, "Alpha Agent") },
  { id: "b2", value: "b2", children: h("span", null, "Beta Agent") },
  { id: "c3", value: "c3", children: h("span", null, "Gamma Agent") },
];

describe("CommandSelect keyboard navigation", () => {
  it("moves the highlight with ArrowDown and selects with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      h(CommandSelect, {
        options,
        onSelect,
        onSearch: () => {},
        value: "",
        placeholder: "Select an agent",
      }),
    );

    await user.click(screen.getByRole("button", { name: /select an agent/i }));

    const items = await screen.findAllByRole("option");
    expect(items).toHaveLength(3);

    // First item becomes selected by default.
    await waitFor(() => {
      expect(items[0].getAttribute("aria-selected")).toBe("true");
    });

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(items[1].getAttribute("aria-selected")).toBe("true");
    });

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(items[2].getAttribute("aria-selected")).toBe("true");
    });

    await user.keyboard("{ArrowUp}");
    await waitFor(() => {
      expect(items[1].getAttribute("aria-selected")).toBe("true");
    });

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("b2");
  });
});
