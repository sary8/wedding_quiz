import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders image when src is provided", () => {
    render(<Avatar src="/avatar.jpg" alt="User Avatar" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/avatar.jpg");
    expect(img).toHaveAttribute("alt", "User Avatar");
  });

  it("renders fallback when no src is provided", () => {
    render(<Avatar alt="John Doe" />);
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("uses custom fallback text when provided", () => {
    render(<Avatar alt="John Doe" fallback="JD" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("extracts first character from alt for fallback", () => {
    render(<Avatar alt="Alice" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("applies small size class", () => {
    const { container } = render(<Avatar alt="User" size="sm" />);
    const avatar = container.firstChild;
    expect(avatar).toHaveClass("w-8", "h-8");
  });

  it("applies medium size class by default", () => {
    const { container } = render(<Avatar alt="User" />);
    const avatar = container.firstChild;
    expect(avatar).toHaveClass("w-12", "h-12");
  });

  it("applies large size class", () => {
    const { container } = render(<Avatar alt="User" size="lg" />);
    const avatar = container.firstChild;
    expect(avatar).toHaveClass("w-16", "h-16");
  });

  it("applies custom className", () => {
    const { container } = render(<Avatar alt="User" className="custom-avatar" />);
    expect(container.firstChild).toHaveClass("custom-avatar");
  });

  it("applies loading lazy to images", () => {
    render(<Avatar src="/avatar.jpg" alt="User" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});
