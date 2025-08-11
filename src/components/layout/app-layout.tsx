// src/components/layout/app-layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Refrigerator,
  ChefHat,
  ShoppingCart,
  ClipboardPlus,
  Archive,
  BarChart3,
  Users,
  BookOpen,
  Settings,
  Menu,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import React from 'react';

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/meal-planner", label: "Meal Plan", icon: CalendarDays },
  { href: "/my-fridge", label: "My Fridge", icon: Refrigerator },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/grocery-list", label: "Grocery List", icon: ShoppingCart },
  { href: "/log-food", label: "Log Food", icon: ClipboardPlus },
  { href: "/pantry", label: "Pantry", icon: Archive },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/community", label: "Community", icon: Users, disabled: false }, // Enabled
  { href: "/learn", label: "Learn", icon: BookOpen, disabled: false }, // Enabled
  { href: "/settings", label: "Settings", icon: Settings, disabled: false },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);

  const NavLink = ({ item, isMobile }: { item: typeof navItems[0], isMobile?: boolean }) => (
    <Link
      href={item.disabled ? "#" : item.href}
      onClick={isMobile && !item.disabled ? () => setIsMobileSheetOpen(false) : undefined}
      className={cn(
        "flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        pathname === item.href
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        item.disabled && "cursor-not-allowed opacity-50"
      )}
      aria-disabled={item.disabled}
      tabIndex={item.disabled ? -1 : undefined}
    >
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
    </Link>
  );
  
  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center space-x-2 text-xl font-semibold text-sidebar-foreground">
          <Bot className="h-7 w-7 text-sidebar-primary" />
          <span>NutriMe.AI</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} isMobile={true} />
        ))}
      </nav>
    </div>
  );


  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Sheet */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 md:hidden">
          <Link href="/" className="flex items-center space-x-2 text-lg font-semibold">
            <Bot className="h-6 w-6 text-primary" />
            <span>NutriMe.AI</span>
          </Link>
          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
