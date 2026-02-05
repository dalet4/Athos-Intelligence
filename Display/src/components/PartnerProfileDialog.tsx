import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Building2, Users, Layers, Briefcase } from "lucide-react";
import { Agency } from "@/types/agency";

interface PartnerProfileDialogProps {
    partner: Agency | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PartnerProfileDialog({ partner, open, onOpenChange }: PartnerProfileDialogProps) {
    if (!partner) return null;

    // Real Data for "Notable Partners"
    const partners = partner.partners || [];

    // Safe accessors
    const specializations = partner.specializations || [];
    const platforms = partner.platforms || [];
    const clients = partner.clients || [];
    const caseStudies = partner.case_studies || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-0 gap-0">

                {/* HEADER */}
                <div className="bg-slate-50 border-b p-6 sticky top-0 z-10">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-slate-900 flex flex-col gap-1">
                            {partner.name}
                            {partner.website && (
                                <a
                                    href={partner.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm font-normal text-blue-600 hover:text-blue-800"
                                >
                                    <Building2 className="h-4 w-4" />
                                    {partner.website.replace(/^https?:\/\//, '')}
                                </a>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-8">

                    {/* ABOUT */}
                    <section>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            <span className="opacity-70">📄</span> About
                        </h3>
                        <p className="text-slate-700 leading-relaxed">
                            {partner.description || "No description available."}
                        </p>
                    </section>

                    {/* MAJOR CLIENTS */}
                    <section>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            <Users className="h-4 w-4" /> Major Clients <span className="text-xs normal-case text-slate-400">({clients.length})</span>
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {clients.slice(0, 8).map((client: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                                    <Building2 className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium text-slate-700">{client.name}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 2-Column Grid: Services & Platforms */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* SERVICES OFFERED */}
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                <Layers className="h-4 w-4" /> Services Offered
                            </h3>
                            <ul className="space-y-2">
                                {specializations.length > 0 ? specializations.map((spec, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-slate-600">
                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                        {spec}
                                    </li>
                                )) : <li className="text-slate-400 italic">No services listed</li>}
                            </ul>
                        </div>

                        {/* SUPPORTED PLATFORMS */}
                        <div>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                <Layers className="h-4 w-4" /> Supported Platforms
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {platforms.length > 0 ? platforms.map((plat, idx) => (
                                    <Badge key={idx} variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                                        {plat}
                                    </Badge>
                                )) : <span className="text-slate-400 italic">No platforms listed</span>}
                            </div>
                        </div>
                    </div>

                    {/* CASE STUDIES */}
                    <section>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            <Briefcase className="h-4 w-4" /> Case Studies
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {caseStudies.length > 0 ? caseStudies.map((study: any, idx: number) => (
                                <a
                                    key={idx}
                                    href={study.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                                >
                                    <span className="font-medium text-slate-800 group-hover:text-blue-700">
                                        {study.title || "Untitled Case Study"}
                                    </span>
                                    <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                                </a>
                            )) : <p className="text-slate-400 italic">No case studies available</p>}
                        </div>
                    </section>

                    {/* NOTABLE PARTNERS (Real Data) */}
                    {/* NOTABLE PARTNERS (Real Data) */}
                    {partners.length > 0 && (
                        <section className="pt-4 border-t border-slate-100">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                Notable Partners
                            </h3>
                            <div className="flex gap-4">
                                {partners.map((p, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-slate-500 text-sm">
                                        <Building2 className="h-3 w-3" /> {p}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* AWARDS SECTION */}
                    {partner.awards && partner.awards.length > 0 && (
                        <section className="pt-4 border-t border-slate-100">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                🏆 Awards
                            </h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {partner.awards.map((award, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-700 bg-yellow-50 px-3 py-2 rounded border border-yellow-100">
                                        <span className="font-bold text-yellow-600">{award.year}</span>
                                        <span>{award.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* TEAM / DIRECTORS SECTION */}
                    {partner.directors && partner.directors.length > 0 && (
                        <section className="pt-4 border-t border-slate-100">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                👥 Key Leadership
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {partner.directors.map((director, idx) => (
                                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
                                        <div className="font-medium text-slate-900 truncate" title={director.name}>{director.name}</div>
                                        <div className="text-xs text-slate-500 truncate mb-2" title={director.role}>{director.role}</div>
                                        <div className="flex gap-2">
                                            {director.linkedin_url && (
                                                <a href={director.linkedin_url} target="_blank" rel="noopener" className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1">
                                                    <Briefcase className="h-3 w-3" /> LinkedIn
                                                </a>
                                            )}
                                            {director.email && (
                                                <a href={`mailto:${director.email}`} className="text-slate-600 hover:text-slate-900 text-xs flex items-center gap-1">
                                                    📧 Email
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
}
