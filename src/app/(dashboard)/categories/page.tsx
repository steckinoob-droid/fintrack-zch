import type { Metadata } from "next";
import { CategoriesClient } from "@/components/categories/categories-client";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriesPage() {
  return <CategoriesClient />;
}
