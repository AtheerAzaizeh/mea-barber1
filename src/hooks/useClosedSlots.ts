import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey } from "@/lib/constants";

export interface ClosedSlot {
  id: string;
  closed_date: string;
  closed_time: string | null;
  reason: string | null;
  created_at: string;
}

export function useClosedSlots() {
  const [closedSlots, setClosedSlots] = useState<ClosedSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosedSlots = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("closed_slots")
        .select("*")
        .order("closed_date", { ascending: true });

      if (error) throw error;
      setClosedSlots(data || []);
    } catch (err) {
      console.error("Error fetching closed slots:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosedSlots();

    // Set up realtime subscription
    const channel = supabase
      .channel("closed-slots-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "closed_slots",
        },
        () => {
          fetchClosedSlots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const closeSlot = async (
    closed_date: string,
    closed_time: string | null,
    reason?: string
  ) => {
    const { data, error } = await supabase
      .from("closed_slots")
      .insert([{ closed_date, closed_time, reason }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const openSlot = async (id: string) => {
    const { error } = await supabase.from("closed_slots").delete().eq("id", id);
    if (error) throw error;
  };

  const isSlotClosed = (date: Date, time?: string): boolean => {
    const dateStr = toDateKey(date);

    // Check if entire day is closed
    const dayIsClosed = closedSlots.some(
      (slot) => slot.closed_date === dateStr && slot.closed_time === null
    );
    if (dayIsClosed) return true;

    // Check if specific time is closed
    if (time) {
      return closedSlots.some(
        (slot) => slot.closed_date === dateStr && slot.closed_time === time
      );
    }

    return false;
  };

  return {
    closedSlots,
    loading,
    closeSlot,
    openSlot,
    isSlotClosed,
    refetch: fetchClosedSlots,
  };
}
