import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, FileArchive, Loader2 } from 'lucide-react';
import { UFHLogo } from '@/components/UFHLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchApplicationDocuments, checkDocumentsComplete } from '@/lib/hrDocumentPack';

const AdminDocuments = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { setLoading, setMessage } = useLoading();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppDocs, setSelectedAppDocs] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
    try {
      // placeholder: call existing function or endpoint in future
      toast.success('HR pack generation started');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate HR pack');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-yellow-50 text-sidebar-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-400 flex items-center justify-center">
              <UFHLogo className="w-10 h-10" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-800">Documents Manager</h1>
              <p className="text-xs text-muted-foreground">View applicant uploads and compile HR packs</p>
            </div>
          </Link>
          <div>
            <Button asChild>
              <a href="/admin">Back to Admin</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Applicant Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {applications.map(app => (
                <div key={app.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                  <div>
                    <p className="font-medium">{app.full_name}</p>
                    <p className="text-sm text-muted-foreground">{app.student_number} • {app.faculty}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => openDocuments(app)}>View Documents</Button>
                    <Button size="sm" variant="outline" onClick={() => generateHRPack(app.id)} disabled={!documentsComplete || isGenerating}>
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileArchive className="w-4 h-4 mr-2" />}
                      Generate HR Pack
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Simple modal-like area for selected application documents */}
        {selectedApp && (
          <div className="mt-6 p-4 border rounded bg-muted/10">
            <h3 className="font-semibold mb-2">{selectedApp.full_name} — Documents</h3>
            {selectedAppDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {selectedAppDocs.map(d => (
                  <div key={d.file_path} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{d.label ? `${d.label} — ${d.file_name}` : d.file_name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => downloadDocument(d.file_path, d.file_name)}>
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
