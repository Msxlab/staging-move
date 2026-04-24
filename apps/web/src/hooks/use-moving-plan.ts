import { useState, useEffect, useCallback } from "react";

interface MovingPlan {
  id: string;
  fromAddress: { street: string; city: string; state: string; zip: string };
  toAddress: { street: string; city: string; state: string; zip: string };
  moveDate: string;
  status: string;
  tasks?: { id: string; completed: boolean }[];
  boxes?: { id: string; isPacked: boolean }[];
}

export function useMovingPlans() {
  const [plans, setPlans] = useState<MovingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/moving");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPlans(data.plans);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  return { plans, loading, error, refetch: fetchPlans };
}

export function useMovingPlan(id: string) {
  const [plan, setPlan] = useState<MovingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/moving/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPlan(data.plan);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  return { plan, loading, error, refetch: fetchPlan };
}
