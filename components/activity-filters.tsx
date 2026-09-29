"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUSES, statusLabel } from "@/components/status-badge";

const TEXT_KEYS = ["employeeName", "designation", "assignedBy", "dateFrom", "dateTo", "search"] as const;

export function ActivityFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "ALL");
  const active = [...TEXT_KEYS, "status"].filter((k) => params.get(k)).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const qs = new URLSearchParams();
    for (const key of TEXT_KEYS) {
      const value = String(form.get(key) ?? "").trim();
      if (value) qs.set(key, value);
    }
    if (status !== "ALL") qs.set("status", status);
    router.push(qs.size ? `/manager?${qs.toString()}` : "/manager");
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-3 lg:col-span-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          name="search"
          type="search"
          defaultValue={params.get("search") ?? ""}
          placeholder="Words in the activity or details"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employeeName">Employee</Label>
        <Input id="employeeName" name="employeeName" defaultValue={params.get("employeeName") ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="designation">Designation</Label>
        <Input id="designation" name="designation" defaultValue={params.get("designation") ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "ALL")}>
          <SelectTrigger id="filter-status" className="w-full">
            <SelectValue>{(v: string) => (v === "ALL" ? "All statuses" : statusLabel(v as never))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-assignedBy">Assigned by</Label>
        <Input id="filter-assignedBy" name="assignedBy" defaultValue={params.get("assignedBy") ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateFrom">From</Label>
        <Input id="dateFrom" name="dateFrom" type="date" defaultValue={params.get("dateFrom") ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateTo">To</Label>
        <Input id="dateTo" name="dateTo" type="date" defaultValue={params.get("dateTo") ?? ""} />
      </div>
      <div className="col-span-full flex items-end gap-2 sm:justify-end">
        <Button type="submit" className="flex-1 sm:flex-none">
          Apply filters
        </Button>
        {active > 0 && (
          <Button type="button" variant="outline" onClick={() => router.push("/manager")}>
            Clear {active}
          </Button>
        )}
      </div>
    </form>
  );
}
