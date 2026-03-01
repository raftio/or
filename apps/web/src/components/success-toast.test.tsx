import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SuccessToast } from "./success-toast";

describe("SuccessToast", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the success message", () => {
    render(
      <SuccessToast message="Bundle completed!" duration={0} onDismiss={() => {}} />,
    );
    expect(screen.getByText("Bundle Complete")).toBeInTheDocument();
    expect(screen.getByText("Bundle completed!")).toBeInTheDocument();
  });

  it("has the correct accessibility role", () => {
    render(
      <SuccessToast message="Done" duration={0} onDismiss={() => {}} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onDismiss when close button is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SuccessToast message="Done" duration={0} onDismiss={onDismiss} />);

    const button = screen.getByLabelText("Dismiss notification");
    await user.click(button);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses after the specified duration", () => {
    const onDismiss = vi.fn();
    render(<SuccessToast message="Done" duration={3000} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not auto-dismiss when duration is 0", () => {
    const onDismiss = vi.fn();
    render(<SuccessToast message="Persistent" duration={0} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText("Persistent")).toBeInTheDocument();
  });

  it("applies enter animation classes after mount", () => {
    render(
      <SuccessToast message="Animated" duration={0} onDismiss={() => {}} />,
    );

    const toast = screen.getByRole("status");
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(toast.className).toContain("translate-x-0");
    expect(toast.className).toContain("opacity-100");
  });
});
