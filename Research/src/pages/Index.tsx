import { useState } from "react";
import { AgencyAnalyzer } from "@/components/AgencyAnalyzer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Ecommerce Agency Analyzer
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Enter an ecommerce development agency URL to analyze their supported platforms, 
            client portfolio, and client revenue data.
          </p>
        </div>
        <AgencyAnalyzer />
      </div>
    </div>
  );
};

export default Index;
