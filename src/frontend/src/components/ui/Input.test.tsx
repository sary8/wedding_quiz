import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./Input";

describe("Input", () => {
  it("renders input field", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Input label="Username" />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("renders error message", () => {
    render(<Input error="This field is required" />);
    const errorMessage = screen.getByRole("alert");
    expect(errorMessage).toHaveTextContent("This field is required");
  });

  it("renders helper text when no error", () => {
    render(<Input helperText="Enter your username" />);
    expect(screen.getByText("Enter your username")).toBeInTheDocument();
  });

  it("does not show helper text when error is present", () => {
    render(<Input helperText="Helper" error="Error message" />);
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("sets aria-invalid when error is present", () => {
    render(<Input error="Invalid" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("sets aria-invalid to false when no error", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "false");
  });

  it("connects label to input with htmlFor/id", () => {
    render(<Input label="Email" id="email-input" />);
    const input = screen.getByRole("textbox");
    const label = screen.getByText("Email");
    expect(input).toHaveAttribute("id", "email-input");
    expect(label).toHaveAttribute("for", "email-input");
  });

  it("generates a stable id if not provided", () => {
    // useId() は同一インスタンスでは安定したIDを返す
    const { rerender } = render(<Input label="Field 1" />);
    const id1 = screen.getByRole("textbox").getAttribute("id");
    rerender(<Input label="Field 1 updated" />);
    const id2 = screen.getByRole("textbox").getAttribute("id");

    expect(id1).toBeTruthy();
    expect(id1).toBe(id2); // 同一インスタンス → 同じIDを維持
  });

  it("generates unique ids for separate instances", () => {
    // 同時にレンダーされた別インスタンスは異なるIDを持つ
    render(
      <>
        <Input label="Field A" data-testid="a" />
        <Input label="Field B" data-testid="b" />
      </>
    );
    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0].getAttribute("id")).not.toBe(inputs[1].getAttribute("id"));
  });

  it("handles onChange event", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "test");

    expect(handleChange).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole("textbox")).toHaveClass("custom-input");
  });

  it("forwards ref to input element", () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
  });

  it("applies error styling to input when error exists", () => {
    render(<Input error="Error" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-red-500", "bg-red-50");
  });
});
