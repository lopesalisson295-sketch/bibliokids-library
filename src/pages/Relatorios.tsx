import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

const Relatorios = () => {
    const [loading, setLoading] = useState(true);
    const [topBooks, setTopBooks] = useState<{ nome: string; emprestimos: number }[]>([]);
    const [byTurma, setByTurma] = useState<{ turma: string; emprestimos: number }[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empRes, livrosRes, alunosRes] = await Promise.all([
                supabase.from("emprestimos").select("*"),
                supabase.from("livros").select("*"),
                supabase.from("alunos").select("*"),
            ]);

            const emprestimos = empRes.data || [];
            const livros = livrosRes.data || [];
            const alunos = alunosRes.data || [];

            // Top books
            const bookCounts: Record<string, number> = {};
            emprestimos.forEach(e => {
                bookCounts[e.livro_id] = (bookCounts[e.livro_id] || 0) + 1;
            });
            const livrosMap = Object.fromEntries(livros.map(l => [l.id, l.titulo]));
            const topBooksData = Object.entries(bookCounts)
                .map(([id, count]) => ({ nome: livrosMap[id] || "Desconhecido", emprestimos: count }))
                .sort((a, b) => b.emprestimos - a.emprestimos)
                .slice(0, 8);
            setTopBooks(topBooksData);

            // By turma
            const alunosMap = Object.fromEntries(alunos.map(a => [a.id, a.turma]));
            const turmaCounts: Record<string, number> = {};
            emprestimos.forEach(e => {
                const turma = alunosMap[e.aluno_id] || "Sem turma";
                turmaCounts[turma] = (turmaCounts[turma] || 0) + 1;
            });
            const turmaData = Object.entries(turmaCounts)
                .map(([turma, count]) => ({ turma, emprestimos: count }))
                .sort((a, b) => b.emprestimos - a.emprestimos);
            setByTurma(turmaData);
        } catch (err) {
            console.error("Error fetching reports:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Top Books Chart */}
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BookOpen className="h-5 w-5 text-amber-500" />
                            Livros Mais Emprestados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-72 w-full" />
                        ) : topBooks.length === 0 ? (
                            <div className="flex items-center justify-center h-72 text-muted-foreground text-sm">
                                Nenhum dado disponível
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topBooks} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="nome" fontSize={11} tickLine={false} axisLine={false} width={120} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px",
                                            fontSize: "13px",
                                        }}
                                    />
                                    <Bar dataKey="emprestimos" fill="hsl(38, 92%, 50%)" radius={[0, 6, 6, 0]} name="Empréstimos" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* By Turma Chart */}
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Users className="h-5 w-5 text-emerald-500" />
                            Empréstimos por Turma
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-72 w-full" />
                        ) : byTurma.length === 0 ? (
                            <div className="flex items-center justify-center h-72 text-muted-foreground text-sm">
                                Nenhum dado disponível
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={byTurma}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        innerRadius={50}
                                        paddingAngle={3}
                                        dataKey="emprestimos"
                                        nameKey="turma"
                                        label={({ turma, emprestimos }) => `${turma} (${emprestimos})`}
                                        labelLine={false}
                                        fontSize={11}
                                    >
                                        {byTurma.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px",
                                            fontSize: "13px",
                                        }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Summary Stats */}
            {!loading && (
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BarChart3 className="h-5 w-5 text-violet-500" />
                            Resumo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid sm:grid-cols-3 gap-6">
                            <div className="text-center p-4 rounded-xl bg-amber-50">
                                <p className="text-3xl font-bold text-amber-600">{topBooks.reduce((sum, b) => sum + b.emprestimos, 0)}</p>
                                <p className="text-sm text-amber-700 mt-1">Total de Empréstimos</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-blue-50">
                                <p className="text-3xl font-bold text-blue-600">{topBooks.length}</p>
                                <p className="text-sm text-blue-700 mt-1">Livros Diferentes Emprestados</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-emerald-50">
                                <p className="text-3xl font-bold text-emerald-600">{byTurma.length}</p>
                                <p className="text-sm text-emerald-700 mt-1">Turmas Participantes</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Relatorios;
