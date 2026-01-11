import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, Users, FileCheck, ChevronRight, CheckCircle2, Clock, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Typewriter from '@/components/Typewriter';


const Index = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">UFH Tutors</h1>
              <p className="text-xs text-muted-foreground">University of Fort Hare</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {isAdmin === true ? (
                  <Link to="/admin">
                    <Button variant="outline">Admin Dashboard</Button>
                  </Link>
                ) : (
                  <Link to="/dashboard">
                    <Button variant="outline">My Dashboard</Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button className="btn-gradient-primary text-primary-foreground shadow-md hover:shadow-lg transition-shadow">
                    Apply Now
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 bg-hero-gradient overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm mb-6 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Applications Open for 2026
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <Typewriter
                text="Shape the Future of Learning at UFH"
                speed={100}
                delay={500}
                className="block"
                cursorClassName="text-accent"
              />
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Join our tutoring program and help fellow students succeed. Share your knowledge, 
              develop leadership skills, and make a real difference in your university community.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Link to={user ? '/dashboard' : '/auth?mode=signup'}>
                <Button size="lg" className="btn-gradient-accent text-accent-foreground font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8">
                  {user ? 'View My Application' : 'Start Your Application'}
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <button 
                onClick={() => document.getElementById('why-become-tutor')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border h-11 rounded-md px-8 border-white/30 text-white hover:bg-white/10"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features Section */}
      <section id="why-become-tutor" className="py-20 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Become a UFH Tutor?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Being a tutor is more than just a job—it's an opportunity to grow, lead, and inspire.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all">
                  <GraduationCap className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">Academic Growth</h3>
                <p className="text-muted-foreground">
                  Deepen your understanding of subjects while developing teaching skills that last a lifetime.
                </p>
              </CardContent>
            </Card>
            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center mb-6 group-hover:bg-secondary group-hover:scale-110 transition-all">
                  <Users className="w-7 h-7 text-secondary group-hover:text-secondary-foreground transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">Build Community</h3>
                <p className="text-muted-foreground">
                  Connect with students across faculties and create lasting professional relationships.
                </p>
              </CardContent>
            </Card>
            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent group-hover:scale-110 transition-all">
                  <FileCheck className="w-7 h-7 text-accent group-hover:text-accent-foreground transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">Career Ready</h3>
                <p className="text-muted-foreground">
                  Gain valuable work experience and references that employers value highly.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple Application Process
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get started in just a few steps. We've made it easy for you to apply.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                    1
                  </div>
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary to-secondary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">Create Account</h3>
                <p className="text-muted-foreground text-sm">
                  Sign up using your UFH student email address
                </p>
              </div>
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                    2
                  </div>
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-secondary to-accent" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">Complete Application</h3>
                <p className="text-muted-foreground text-sm">
                  Fill in your details and upload required documents
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                  3
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">Get Reviewed</h3>
                <p className="text-muted-foreground text-sm">
                  Track your status and receive feedback from admins
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-6 h-6 text-success" />
              <span>Secure Application</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="w-6 h-6 text-primary" />
              <span>Quick Review Process</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="w-6 h-6 text-secondary" />
              <span>Data Protected</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-hero-gradient">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Make an Impact?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Join our tutoring team and help shape the academic success of your fellow students.
          </p>
          <Link to={user ? '/dashboard' : '/auth?mode=signup'}>
            <Button size="lg" className="btn-gradient-accent text-accent-foreground font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 px-10">
              {user ? 'Go to Dashboard' : 'Apply Today'}
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground text-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-lg">UFH Tutor Portal</h3>
                <p className="text-sm text-muted-foreground">University of Fort Hare</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 University of Fort Hare. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
