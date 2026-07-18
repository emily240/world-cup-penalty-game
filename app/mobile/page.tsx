import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "World Cup Penalty · iPhone Portrait",
  description: "Portrait-mode World Cup penalty game for iPhone.",
};

export default function MobilePage(){
  return <Home mobileMode />;
}
