import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DropdownMenuContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

interface DropdownMenuProps {
  children: React.ReactNode;
}

function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);

  return (
    <DropdownMenuContext.Provider value={{ open, onOpenChange: setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

function DropdownMenuTrigger({ children, asChild }: DropdownMenuTriggerProps) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    context.onOpenChange(!context.open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void; ref?: React.Ref<HTMLElement> }>, {
      onClick: handleClick,
      ref: context.triggerRef,
    });
  }

  return (
    <button type="button" onClick={handleClick} ref={context.triggerRef as React.RefObject<HTMLButtonElement>}>
      {children}
    </button>
  );
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 4,
  children,
  ...props
}: DropdownMenuContentProps) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");

  const ref = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  // Calculer la position du dropdown
  React.useEffect(() => {
    if (context.open && context.triggerRef.current) {
      const triggerRect = context.triggerRef.current.getBoundingClientRect();
      const menuWidth = ref.current?.offsetWidth || 200;

      let left = triggerRect.left;
      if (align === "end") {
        left = triggerRect.right - menuWidth;
      } else if (align === "center") {
        left = triggerRect.left + (triggerRect.width / 2) - (menuWidth / 2);
      }

      // S'assurer que le menu ne dépasse pas à droite
      const maxLeft = window.innerWidth - menuWidth - 8;
      left = Math.min(left, maxLeft);
      left = Math.max(8, left);

      setPosition({
        top: triggerRect.bottom + sideOffset,
        left,
      });
    }
  }, [context.open, context.triggerRef, align, sideOffset]);

  // Fermer sur clic extérieur
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        context.triggerRef.current &&
        !context.triggerRef.current.contains(event.target as Node)
      ) {
        context.onOpenChange(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        context.onOpenChange(false);
      }
    };

    if (context.open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [context.open, context]);

  if (!context.open) return null;

  // Utiliser un portal pour rendre le dropdown à la racine du DOM
  return createPortal(
    <div
      ref={ref}
      className={cn(
        "fixed z-[9999] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-lg animate-fade-in",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, inset, onClick, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      context?.onOpenChange(false);
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 disabled:pointer-events-none disabled:opacity-50",
          inset && "pl-8",
          className
        )}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("-mx-1 my-1 h-px bg-gray-100", className)}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-sm font-semibold",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
