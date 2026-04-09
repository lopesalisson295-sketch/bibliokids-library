import { useEffect, useState } from "react";
import { BookOpen, ArrowLeftRight, AlertTriangle, Users, TrendingUp, Award, BookMarked, Activity, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subMonths, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import ImageLightbox from "@/components/ImageLightbox";
import { syncOverdueLoans } from "@/hooks/useAutoUpdateOverdue";

interface LoanActivity {
  id: string;
  status: string;
  data_emprestimo: string;
  aluno_nome?: string;
  livro_titulo?: string;
  realStatus?: string;
}

const COLORS = ['#10b981', '#3b82f6', '#ef4444']; // Devolvido (emerald), Ativo (blue), Atrasado (red)

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [totalBooks, setTotalBooks] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [overdueLoans, setOverdueLoans] = useState(0);
  const [recentActivity, setRecentActivity] = useState<LoanActivity[]>([]);
  const [chartData, setChartData] = useState<{ month: string; emprestimos: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [topBooks, setTopBooks] = useState<{ titulo: string; count: number; capa_url?: string }[]>([]);
  const [topStudents, setTopStudents] = useState<{ nome: string; count: number; foto_url?: string }[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [lightboxAlt, setLightboxAlt] = useState("");

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // ✅ Sincronizar automaticamente empréstimos atrasados no banco
      await syncOverdueLoans();

      const [booksRes, studentsRes, loansRes] = await Promise.all([
        supabase.from("livros").select("id, titulo, capa_url"),
        supabase.from("alunos").select("id, nome, foto_url"),
        supabase.from("emprestimos").select("*").order("criado_em", { ascending: false }),
      ]);

      const books = booksRes.data || [];
      const students = studentsRes.data || [];
      const loans = loansRes.data || [];

      setTotalBooks(books.length);
      setTotalStudents(students.length);

      const booksMap = Object.fromEntries(books.map(b => [b.id, b]));
      const studentsMap = Object.fromEntries(students.map(s => [s.id, s]));

      const now = new Date();

      const getStatus = (l: any) => {
        if (l.status === "devolvido") return "devolvido";
        if (isAfter(now, new Date(l.data_devolucao_prevista))) return "atrasado";
        return "ativo";
      };

      const active = loans.filter(l => getStatus(l) === "ativo");
      const overdue = loans.filter(l => getStatus(l) === "atrasado");
      const returned = loans.filter(l => getStatus(l) === "devolvido");

      setActiveLoans(active.length);
      setOverdueLoans(overdue.length);

      setStatusData([
        { name: "Devolvidos", value: returned.length },
        { name: "Ativos", value: active.length },
        { name: "Atrasados", value: overdue.length },
      ]);

      // Recent activity
      const recentLoans = loans.slice(0, 5);
      const activityWithNames: LoanActivity[] = recentLoans.map(loan => ({
        id: loan.id,
        status: loan.status,
        data_emprestimo: loan.data_emprestimo,
        aluno_nome: studentsMap[loan.aluno_id]?.nome || "—",
        livro_titulo: booksMap[loan.livro_id]?.titulo || "—",
        realStatus: getStatus(loan)
      }));
      setRecentActivity(activityWithNames);

      // Top Books
      const bookCounts: Record<string, number> = {};
      const studentCounts: Record<string, number> = {};

      loans.forEach(l => {
        bookCounts[l.livro_id] = (bookCounts[l.livro_id] || 0) + 1;
        studentCounts[l.aluno_id] = (studentCounts[l.aluno_id] || 0) + 1;
      });

      const topB = Object.entries(bookCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({
          titulo: booksMap[id]?.titulo || "Desconhecido",
          count,
          capa_url: booksMap[id]?.capa_url
        }));

      const topS = Object.entries(studentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({
          nome: studentsMap[id]?.nome || "Desconhecido",
          count,
          foto_url: studentsMap[id]?.foto_url
        }));

      setTopBooks(topB);
      setTopStudents(topS);

      // Chart data: loans per month (last 6 months)
      const months: { month: string; emprestimos: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStr = format(monthDate, "yyyy-MM");
        const monthLabel = format(monthDate, "MMM", { locale: ptBR });
        const count = loans.filter(l => l.data_emprestimo.startsWith(monthStr)).length;
        months.push({ month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), emprestimos: count });
      }
      setChartData(months);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { title: "Total de Livros", value: totalBooks, icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { title: "Total de Alunos", value: totalStudents, icon: Users, color: "text-emerald-500", bg: "bg-emerald-50" },
    { title: "Empréstimos Ativos", value: activeLoans, icon: ArrowLeftRight, color: "text-blue-500", bg: "bg-blue-50" },
    { title: " Livros Atrasados", value: overdueLoans, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral da sua biblioteca infantil.</p>
        </div>
        <Badge variant="outline" className="text-xs text-muted-foreground bg-card">
          Atualizado agora
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-all duration-300 hover:-translate-y-1 border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Empréstimos por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    cursor={{ fill: 'hsl(var(--muted))' }}
                  />
                  <Bar dataKey="emprestimos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Empréstimos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-indigo-500" />
              Status de Empréstimos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center">
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : statusData.reduce((a, b) => a + b.value, 0) === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhum empréstimo registrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Leitores */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-500" />
              Melhores Leitores
            </CardTitle>
            <CardDescription>Alunos com mais empréstimos</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : topStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Dados insuficientes</p>
            ) : (
              <div className="space-y-4">
                {topStudents.map((aluno, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="font-bold text-muted-foreground w-4 text-center">{idx + 1}</div>
                    {aluno.foto_url ? (
                      <img
                        src={aluno.foto_url}
                        alt={aluno.nome}
                        className="w-8 h-8 rounded-full object-cover shadow-sm bg-muted flex-shrink-0 clickable-image"
                        onClick={() => openLightbox(aluno.foto_url!, aluno.nome)}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
                        {aluno.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{aluno.nome}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{aluno.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Livros Mais Lidos */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-blue-500" />
              Livros Favoritos
            </CardTitle>
            <CardDescription>Os livros mais emprestados</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : topBooks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Dados insuficientes</p>
            ) : (
              <div className="space-y-4">
                {topBooks.map((livro, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="font-bold text-muted-foreground w-4 text-center">{idx + 1}</div>
                    {livro.capa_url ? (
                      <img
                        src={livro.capa_url}
                        alt={livro.titulo}
                        className="w-6 h-8 rounded object-cover shadow-sm bg-muted flex-shrink-0 clickable-image"
                        onClick={() => openLightbox(livro.capa_url!, livro.titulo)}
                      />
                    ) : (
                      <div className="w-6 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                        <BookOpen className="h-3 w-3" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{livro.titulo}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{livro.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Atividade Recente
            </CardTitle>
            <CardDescription>Últimos registros</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => {
                  const IconComponent = item.realStatus === "ativo" ? ArrowLeftRight :
                    item.realStatus === "devolvido" ? CheckCircle2 : AlertTriangle;
                  const colorClass = item.realStatus === "ativo" ? "text-blue-500 bg-blue-50" :
                    item.realStatus === "devolvido" ? "text-emerald-500 bg-emerald-50" : "text-red-500 bg-red-50";

                  return (
                    <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors">
                      <div className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 ${colorClass}`}>
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.livro_titulo}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] text-muted-foreground truncate">{item.aluno_nome}</p>
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {format(new Date(item.data_emprestimo), "dd/MM")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxUrl}
        alt={lightboxAlt}
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl("")}
      />
    </div>
  );
};

export default Dashboard;
