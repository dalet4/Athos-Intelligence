import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ExternalLink, Building, DollarSign, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AgencyService } from "@/services/AgencyService";
import type { AgencyData } from "@/types/agency";

export const AgencyAnalyzer = () => {
  const [url, setUrl] = useState("");
  const [caseStudiesUrl, setCaseStudiesUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScrapingCaseStudies, setIsScrapingCaseStudies] = useState(false);
  const [agencyData, setAgencyData] = useState<AgencyData | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setAgencyData(null);

    try {
      const data = await AgencyService.analyzeAgency(url);
      setAgencyData(data);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${data.clients.length} clients and ${data.platforms.length} platforms`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze agency",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrapeCaseStudies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseStudiesUrl.trim() || !agencyData) return;

    setIsScrapingCaseStudies(true);

    try {
      const enrichedData = await AgencyService.scrapeCaseStudies(caseStudiesUrl, agencyData);
      setAgencyData(enrichedData);
      
      toast({
        title: "Case Studies Scraped",
        description: `Added ${enrichedData.additionalCaseStudies?.length || 0} additional case studies`,
      });
    } catch (error) {
      toast({
        title: "Scraping Failed",
        description: error instanceof Error ? error.message : "Failed to scrape case studies",
        variant: "destructive",
      });
    } finally {
      setIsScrapingCaseStudies(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Agency URL Analysis
          </CardTitle>
          <CardDescription>
            Enter the website URL of an ecommerce development agency to analyze
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input
              type="url"
              placeholder="https://agency-website.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Agency"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Case Studies Scraper - Only show after initial analysis */}
      {agencyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Additional Case Studies Scraper
            </CardTitle>
            <CardDescription>
              Enter a URL to scrape additional case studies (e.g., agency's case studies page)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScrapeCaseStudies} className="flex gap-4">
              <Input
                type="url"
                placeholder="https://agency-website.com/case-studies"
                value={caseStudiesUrl}
                onChange={(e) => setCaseStudiesUrl(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit" disabled={isScrapingCaseStudies}>
                {isScrapingCaseStudies ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  "Scrape Case Studies"
                )}
              </Button>
            </form>
            {agencyData.caseStudiesSource && (
              <p className="text-sm text-muted-foreground mt-2">
                Additional case studies scraped from: {agencyData.caseStudiesSource}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {agencyData && (
        <div className="grid gap-8">
          {/* Agency Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {agencyData.name}
              </CardTitle>
              <CardDescription>{agencyData.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <a 
                  href={agencyData.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {agencyData.website}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Agency Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{agencyData.totalCaseStudies}</div>
                <div className="text-sm text-muted-foreground">Total Case Studies</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{agencyData.additionalCaseStudies?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Scraped Studies</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{agencyData.clients.length}</div>
                <div className="text-sm text-muted-foreground">Active Clients</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{agencyData.specializations.length}</div>
                <div className="text-sm text-muted-foreground">Specializations</div>
              </CardContent>
            </Card>
          </div>

          {/* Specializations */}
          <Card>
            <CardHeader>
              <CardTitle>Core Specializations</CardTitle>
              <CardDescription>
                Key areas of expertise and service offerings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {agencyData.specializations.length > 0 ? (
                  agencyData.specializations.map((spec, index) => (
                    <Badge key={index} variant="outline">
                      {spec}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic">No specializations detected</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Supported Platforms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Supported Platforms ({agencyData.platforms.length})
              </CardTitle>
              <CardDescription>
                Ecommerce platforms this agency specializes in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {agencyData.platforms.length > 0 ? (
                  agencyData.platforms.map((platform, index) => (
                    <Badge key={index} variant="secondary">
                      {platform}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic">No platforms detected</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Client Portfolio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Client Portfolio ({agencyData.clients.length})
              </CardTitle>
              <CardDescription>
                Detailed client information with project case studies and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agencyData.clients.length > 0 ? (
                <div className="space-y-6">
                  {agencyData.clients.map((client, index) => (
                    <div key={index} className="border rounded-lg p-6">
                      {/* Client Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2">
                          <h4 className="text-xl font-semibold">{client.name}</h4>
                          <p className="text-muted-foreground">{client.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {client.industry && (
                              <Badge variant="secondary">{client.industry}</Badge>
                            )}
                            {client.platform && (
                              <Badge variant="outline">{client.platform}</Badge>
                            )}
                          </div>
                          {client.website && (
                            <a 
                              href={client.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {client.website}
                            </a>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-2xl font-bold text-primary">
                            {client.estimatedRevenue}
                          </div>
                          <div className="text-sm text-muted-foreground">Annual Revenue</div>
                          {client.projectCount && (
                            <div className="text-sm">
                              <span className="font-medium">{client.projectCount}</span> Projects
                            </div>
                          )}
                          {client.partnershipDuration && (
                            <div className="text-sm text-muted-foreground">
                              {client.partnershipDuration} partnership
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Testimonial */}
                      {client.testimonial && (
                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <p className="italic text-sm">"{client.testimonial}"</p>
                        </div>
                      )}

                      {/* Case Studies */}
                      {client.caseStudies && client.caseStudies.length > 0 && (
                        <div className="space-y-4">
                          <h5 className="font-semibold text-lg">Case Studies</h5>
                          {client.caseStudies.map((caseStudy, csIndex) => (
                            <div key={csIndex} className="bg-card border rounded-lg p-4">
                              <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                  <h6 className="font-medium">{caseStudy.title}</h6>
                                  <div className="flex gap-2">
                                    {caseStudy.projectType && (
                                      <Badge variant="secondary" className="text-xs">
                                        {caseStudy.projectType}
                                      </Badge>
                                    )}
                                    {caseStudy.duration && (
                                      <Badge variant="outline" className="text-xs">
                                        {caseStudy.duration}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <p className="text-sm text-muted-foreground">
                                  {caseStudy.description}
                                </p>

                                {caseStudy.challenge && (
                                  <div>
                                    <span className="text-sm font-medium">Challenge: </span>
                                    <span className="text-sm">{caseStudy.challenge}</span>
                                  </div>
                                )}

                                {caseStudy.solution && (
                                  <div>
                                    <span className="text-sm font-medium">Solution: </span>
                                    <span className="text-sm">{caseStudy.solution}</span>
                                  </div>
                                )}

                                {caseStudy.results && caseStudy.results.length > 0 && (
                                  <div>
                                    <span className="text-sm font-medium">Results:</span>
                                    <ul className="text-sm mt-1 space-y-1">
                                      {caseStudy.results.map((result, rIndex) => (
                                        <li key={rIndex} className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                                          {result}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {caseStudy.technologies && caseStudy.technologies.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    <span className="text-sm font-medium mr-2">Technologies:</span>
                                    {caseStudy.technologies.map((tech, tIndex) => (
                                      <Badge key={tIndex} variant="outline" className="text-xs">
                                        {tech}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No clients detected from the website content.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try using the case studies URL feature to gather more client information.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};