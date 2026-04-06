import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceButton } from "./ChoiceButton";

const NOOP = () => {};

describe("ChoiceButton", () => {
  it("renders choice text", () => {
    render(<ChoiceButton choice="Answer A" color="red" choiceIndex={1} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveTextContent("Answer A");
  });

  it("applies correct pastel color class", () => {
    const { rerender } = render(<ChoiceButton choice="A" color="red" choiceIndex={1} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-pastel-rose");

    rerender(<ChoiceButton choice="B" color="blue" choiceIndex={2} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-pastel-sky");

    rerender(<ChoiceButton choice="C" color="green" choiceIndex={3} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-pastel-mint");

    rerender(<ChoiceButton choice="D" color="yellow" choiceIndex={4} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("bg-choice-pastel-amber");
  });

  it("applies selected styles when isSelected is true", () => {
    render(<ChoiceButton choice="A" color="red" isSelected choiceIndex={1} onClick={NOOP} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("ring-4", "ring-gray-900");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("does not apply selected styles when isSelected is false", () => {
    render(<ChoiceButton choice="A" color="red" isSelected={false} choiceIndex={1} onClick={NOOP} />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("scale-95");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("handles click events with choiceIndex", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<ChoiceButton choice="A" color="red" choiceIndex={3} onClick={handleClick} />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(3);
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<ChoiceButton choice="A" color="red" choiceIndex={1} onClick={handleClick} disabled />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies disabled opacity when disabled and not selected", () => {
    render(<ChoiceButton choice="A" color="red" choiceIndex={1} onClick={NOOP} disabled />);
    expect(screen.getByRole("button")).toHaveClass("opacity-60");
  });

  it("does not apply disabled opacity when selected", () => {
    render(<ChoiceButton choice="A" color="red" choiceIndex={1} onClick={NOOP} disabled isSelected />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("opacity-60");
    expect(button).toHaveClass("ring-4", "ring-gray-900");
  });

  it("uses dark text color for readability", () => {
    render(<ChoiceButton choice="A" color="red" choiceIndex={1} onClick={NOOP} />);
    expect(screen.getByRole("button")).toHaveClass("text-gray-900");
  });
});
