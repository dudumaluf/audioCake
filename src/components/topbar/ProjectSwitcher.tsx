'use client'

import { Check, ChevronDown, FilePlus, FolderOpen, Save, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjectStore } from '@/lib/state/project-store'
import { deleteProject as idbDeleteProject, listProjects, putProject } from '@/lib/storage/idb'
import { exportProject, importProject } from '@/lib/storage/project-io'
import { useAssetStore } from '@/lib/state/asset-store'
import type { Project, SampleRate } from '@/lib/types'

/**
 * Project switcher in the topbar: shows the current project's name (click to
 * rename) and a dropdown for create / open / duplicate / delete / import /
 * export.
 */
export function ProjectSwitcher() {
  const projectName = useProjectStore((s) => s.projectName)
  const projectId = useProjectStore((s) => s.projectId)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const newProject = useProjectStore((s) => s.newProject)
  const loadProjectData = useProjectStore((s) => s.loadProjectData)
  const toProject = useProjectStore((s) => s.toProject)
  const loadAssets = useAssetStore((s) => s.load)

  const [projects, setProjects] = useState<Project[]>([])
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('Untitled')
  const [newRate, setNewRate] = useState<SampleRate>(48000)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setProjects(await listProjects())
  }, [])

  useEffect(() => {
    // Defer the initial load off the render path so the React-19 lint
    // ("don't setState directly in effect") is satisfied. The data still
    // arrives via the same async setProjects path.
    queueMicrotask(() => void refresh())
  }, [refresh])

  const handleSave = useCallback(async () => {
    const p = toProject()
    p.updatedAt = Date.now()
    await putProject(p)
    await refresh()
    toast.success('Project saved', { description: p.name })
  }, [refresh, toProject])

  const handleOpen = useCallback(
    async (p: Project) => {
      loadProjectData(p)
      toast.success('Opened', { description: p.name })
    },
    [loadProjectData],
  )

  const handleDelete = useCallback(
    async (p: Project) => {
      if (!confirm(`Delete project "${p.name}"? Audio assets in the library are kept.`)) return
      await idbDeleteProject(p.id)
      await refresh()
      if (p.id === projectId) {
        newProject('Untitled')
      }
      toast.success('Project deleted')
    },
    [newProject, projectId, refresh],
  )

  const handleDuplicate = useCallback(
    async (p: Project) => {
      const now = Date.now()
      const dup: Project = {
        ...p,
        id: ulid(),
        name: `${p.name} copy`,
        createdAt: now,
        updatedAt: now,
      }
      await putProject(dup)
      await refresh()
      toast.success('Duplicated', { description: dup.name })
    },
    [refresh],
  )

  const handleExportAcproj = useCallback(async () => {
    try {
      const p = toProject()
      p.updatedAt = Date.now()
      await putProject(p)
      const blob = await exportProject(p)
      downloadBlob(blob, `${sanitize(p.name) || 'project'}.acproj`)
      toast.success('Project exported', { description: `${p.name}.acproj` })
    } catch (e) {
      toast.error('Export failed', { description: (e as Error).message })
    }
  }, [toProject])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const { project, importedAssets } = await importProject(file)
        await loadAssets()
        loadProjectData(project)
        await refresh()
        toast.success('Project imported', {
          description: `${project.name} (+${importedAssets} asset${importedAssets === 1 ? '' : 's'})`,
        })
      } catch (e) {
        toast.error('Import failed', { description: (e as Error).message })
      }
    },
    [loadAssets, loadProjectData, refresh],
  )

  return (
    <div className="flex items-center gap-1">
      {renaming ? (
        <Input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            setRenaming(false)
            if (draftName.trim()) setProjectName(draftName.trim())
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setRenaming(false)
              if (draftName.trim()) setProjectName(draftName.trim())
            } else if (e.key === 'Escape') {
              setRenaming(false)
              setDraftName(projectName)
            }
          }}
          className="h-7 w-44 px-2 text-sm"
        />
      ) : (
        <button
          onClick={() => {
            setDraftName(projectName)
            setRenaming(true)
          }}
          className="hover:bg-foreground/5 max-w-[160px] truncate rounded px-1.5 py-0.5 text-sm font-medium"
          title={projectName}
        >
          {projectName}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-6" aria-label="Project menu">
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem onClick={() => setNewOpen(true)}>
            <FilePlus className="size-4" /> New project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSave}>
            <Save className="size-4" /> Save now
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportAcproj}>
            <FolderOpen className="size-4" /> Export .acproj
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="size-4" /> Import .acproj
          </DropdownMenuItem>
          <input
            ref={fileInputRef}
            type="file"
            accept=".acproj,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImportFile(f)
              e.target.value = ''
            }}
          />
          {projects.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-[10px] tracking-wider uppercase">
                Open recent
              </DropdownMenuLabel>
              {projects.slice(0, 12).map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleOpen(p)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {p.id === projectId && <Check className="size-3.5 shrink-0" />}
                    <span className={p.id === projectId ? '' : 'pl-[18px]'}>
                      <span className="truncate">{p.name}</span>
                    </span>
                  </span>
                  <span className="text-muted-foreground ml-auto flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDuplicate(p)
                      }}
                      className="hover:text-foreground text-[10px]"
                      title="Duplicate"
                    >
                      dup
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(p)
                      }}
                      className="hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Start with a fresh set of default tracks. Your library of recordings is shared across
              all projects.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] tracking-wider uppercase">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] tracking-wider uppercase">Sample rate</Label>
              <Select
                value={String(newRate)}
                onValueChange={(v) => setNewRate(Number(v) as SampleRate)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="48000">48 kHz</SelectItem>
                  <SelectItem value="44100">44.1 kHz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                newProject(newName.trim() || 'Untitled', newRate)
                setNewOpen(false)
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
