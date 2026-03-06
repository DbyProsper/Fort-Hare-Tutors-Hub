import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, FileArchive, Loader2, AlertCircle } from 'lucide-react';
import { UFHLogo } from '@/components/UFHLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchApplicationDocuments, checkDocumentsComplete, mergeDocumentsIntoPDF } from '@/lib/hrDocumentPack';

const AdminDocuments = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { setLoading, setMessage } = useLoading();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppDocs, setSelectedAppDocs] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mergeWarnings, setMergeWarnings] = useState<Array<{ name: string; reason: string }>>([]);

  useEffect(() => {
    if (isAdmin) fetchApplications();
  }, [isAdmin]);

  const fetchApplications = async () => {
    setLoading(true);
    setMessage('Loading applications...');
    try {
      const { data, error } = await supabase.from('tutor_applications').select('*').neq('status', 'draft').order('submitted_at', { ascending: false });
      if (error) throw error;
      setApplications(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const openDocuments = async (app: any) => {
    setSelectedApp(app);
    const docs = await fetchApplicationDocuments(app.id);
    setSelectedAppDocs(docs as any[]);
    const complete = await checkDocumentsComplete(app.id);
    setDocumentsComplete(complete);
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    try {
      setLoading(true);
      setMessage('Downloading...');
      const { data, error } = await supabase.storage.from('application-documents').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download document');
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const generateHRPack = async (appId: string) => {
    if (!documentsComplete) return toast.error('All required documents must be uploaded');
    setIsGenerating(true);
    setMergeWarnings([]);
    try {
      // load documents and merge into single PDF using our helper
      const docs = await fetchApplicationDocuments(appId);
      // drop anything that isn't a PDF (pdf-lib can't parse other types)
      const pdfDocs = docs.filter(d => d.file_name?.toLowerCase().endsWith('.pdf'));
      if (pdfDocs.length === 0) {
        toast.error('No PDF documents available to include in the HR pack');
        return;
      }
      if (pdfDocs.length < docs.length) {
        toast.warning('Some non‑PDF files were skipped when generating the pack');
      }
      // need application metadata to create cover page
      const { data: app, error: appErr } = await supabase
        .from('tutor_applications')
        .select('student_number, full_name, department')
        .eq('id', appId)
        .single();
      if (appErr) throw appErr;
      const result = await mergeDocumentsIntoPDF(
        pdfDocs,
        app.student_number,
        app.full_name,
        app.department,
        appId,
        new Date().toLocaleDateString(),
        app.student_number
      );
      
      if (result.blob) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HR_Pack_${appId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show merge result
        if (result.failedDocuments.length > 0) {
          setMergeWarnings(result.failedDocuments);
          toast.warning(
            `⚠ Some documents could not be merged due to encryption. They have been replaced with placeholders in the HR Pack. Please download the original files manually from the applicant profile if required.`
          );
        } else {
          toast.success('HR pack ready for download');
        }
      } else {
        throw new Error('Failed to merge documents');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate HR pack');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <header className="bg-yellow-50 text-sidebar-foreground sticky top-0 z-50">
        <div className="w-full px-4 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <Link to="/admin" className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-yellow-400 flex items-center justify-center flex-shrink-0">
              <UFHLogo className="w-10 h-10" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base md:text-lg text-gray-800 truncate">Documents Manager</h1>
              <p className="text-xs text-muted-foreground truncate">View applicant uploads and compile HR packs</p>
            </div>
          </Link>
          <div className="w-full md:w-auto">
            <Button asChild className="w-full md:w-auto">
              <a href="/admin">Back to Admin</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-6 md:py-8 overflow-x-hidden">
        {mergeWarnings.length > 0 && (
          <div className="mb-6 p-3 md:p-4 rounded-lg border border-yellow-200 bg-yellow-50 overflow-x-hidden">
            <div className="flex items-start gap-2 md:gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-yellow-900 mb-2 text-sm md:text-base">⚠ Some documents could not be merged</h3>
                <p className="text-xs md:text-sm text-yellow-800 mb-3">The following files are encrypted and were replaced with placeholders in the HR Pack. Please download them manually from the applicant profile if required:</p>
                <ul className="text-xs md:text-sm text-yellow-800 space-y-1">
                  {mergeWarnings.map((warning, idx) => (
                    <li key={idx} className="break-words">• <strong>{warning.name}</strong>: {warning.reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Applicant Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 overflow-x-hidden">
              {applications.map(app => (
                <div key={app.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded-lg border bg-card hover:shadow-md transition-shadow gap-3 md:gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm md:text-base">{app.full_name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{app.student_number} • {app.faculty}</p>
                  </div>
                  <div className="flex gap-2 flex-col sm:flex-row w-full md:w-auto">
                    <Button size="sm" onClick={() => openDocuments(app)} className="text-xs md:text-sm flex-1 md:flex-none">View Documents</Button>
                    <Button size="sm" variant="outline" onClick={() => generateHRPack(app.id)} disabled={!documentsComplete || isGenerating} className="text-xs md:text-sm flex-1 md:flex-none">
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileArchive className="w-4 h-4 mr-2" />}
                      <span className="hidden sm:inline">Generate HR Pack</span>
                      <span className="sm:hidden">Generate</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Simple modal-like area for selected application documents */}
        {selectedApp && (
          <div className="mt-6 p-3 md:p-4 border rounded bg-muted/10 overflow-x-hidden">
            <h3 className="font-semibold mb-3 text-sm md:text-base truncate">{selectedApp.full_name} — Documents</h3>
            {selectedAppDocs.length === 0 ? (
              <p className="text-xs md:text-sm text-muted-foreground">No documents uploaded</p>
            ) : (
              <div className="space-y-2 overflow-x-hidden">
                {selectedAppDocs.map(d => (
                  <div key={d.file_path} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 md:p-3 rounded-lg border gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs md:text-sm truncate">{d.label ? `${d.label} — ${d.file_name}` : d.file_name}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => downloadDocument(d.file_path, d.file_name)} className="p-2 h-auto">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDocuments;
