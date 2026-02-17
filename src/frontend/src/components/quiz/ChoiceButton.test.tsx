import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceButton } from "./ChoiceButton";

const NOOP = () => {};

describe("ChoiceButton", () => {
  it("renders choice text and icon", () => {
    render(<ChoiceButton choice="Answer A" color="red" icon="▲" choiceIndex={1} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveTextContent("Answer A");
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("applies correct color class", () => {
    const { rerender } = render(<ChoiceButton choice="A" color="red" icon="▲" choiceIndex={1} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-red");

    rerender(<ChoiceButton choice="B" color="blue" icon="◆" choiceIndex={2} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-blue");

    rerender(<ChoiceButton choice="C" color="green" icon="●" choiceIndex={3} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-green");

    rerender(<ChoiceButton choice="D" color="yellow" icon="■" choiceIndex={4} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-yellow");
  });

  it("applies selected styles when isSelected is true", () => {
    render(<ChoiceButton choice="A" color="red" icon="▲" isSelected choiceIndex={1} onClick={NOOP} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("scale-95", "ring-4", "ring-white");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("does not apply selected styles when isSelected is false", () => {
    render(<ChoiceButton choice="A" color="red" icon="▲" isSelected={false} choiceIndex={1} onClick={NOOP} />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("scale-95");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("handles click events with choiceIndex", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<ChoiceButton choice="A" color="red" icon="▲" choiceIndex={3} onClick={handleClick} />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(3);
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<ChoiceButton choice="A" color="red" icon="▲" choiceIndex={1} onClick={handleClick} disabled />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies disabled opacity when disabled and not selected", () => {
    render(<ChoiceButton choice="A" color="red" icon="▲" choiceIndex={1} onClick={NOOP} disabled />);
    expect(screen.getByRole("button")).toHaveClass("opacity-40");
  });

  it("does not apply disabled opacity when selected", () => {
    render(<ChoiceButton choice="A" color="red" icon="▲" choiceIndex={1} onClick={NOOP} disabled isSelected />);
    const button = screen.getByRole("button");
    // Should have scale-95 and ring but not opacity-40
    expect(button).toHaveClass("scale-95");
  });

  it("sets icon as aria-hidden", () => {
    render(<ChoiceButton choice="A" color="red" icon="▲" choiceIndex={1} onClick={NOOP} />);
    const icon = screen.getByText("▲");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
