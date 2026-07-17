import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Factory, Tags, Pencil, Trash2 } from 'lucide-react';
import listFactoriesFull from '@/actions/settings/listFactoriesFull';
import createFactory from '@/actions/settings/createFactory';
import updateFactory from '@/actions/settings/updateFactory';
import deleteFactory from '@/actions/settings/deleteFactory';
import listProductCategories from '@/actions/settings/listProductCategories';
import createProductCategory from '@/actions/settings/createProductCategory';
import updateProductCategory from '@/actions/settings/updateProductCategory';
import deleteProductCategory from '@/actions/settings/deleteProductCategory';

type FactoryRow = { id: number; name: string; notes: string; product_count: string; batch_count: string; is_used: boolean };
type CategoryRow = { id: number; name: string; is_active: boolean; is_used: boolean };

export function FactoriesCategoriesTab() {
  const [factories, , , reloadFactories] = useLoadAction(listFactoriesFull, [], {});
  const [categories, , , reloadCategories] = useLoadAction(listProductCategories, [], {});
  const [doCreateFactory] = useMutateAction(createFactory);
  const [doUpdateFactory] = useMutateAction(updateFactory);
  const [doDeleteFactory] = useMutateAction(deleteFactory);
  const [doCreateCategory] = useMutateAction(createProductCategory);
  const [doUpdateCategory] = useMutateAction(updateProductCategory);
  const [doDeleteCategory] = useMutateAction(deleteProductCategory);

  const factoryList = asRows<FactoryRow>(factories);
  const categoryList = asRows<CategoryRow>(categories);

  // Factory dialog (add + edit share it)
  const [factoryFormOpen, setFactoryFormOpen] = useState(false);
  const [editFactory, setEditFactory] = useState<FactoryRow | null>(null);
  const [fName, setFName] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fError, setFError] = useState('');
  const [fSaving, setFSaving] = useState(false);

  // Category dialog
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryRow | null>(null);
  const [cName, setCName] = useState('');
  const [cError, setCError] = useState('');
  const [cSaving, setCSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'factory' | 'category'; id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openFactoryForm = (f: FactoryRow | null) => {
    setEditFactory(f); setFName(f?.name || ''); setFNotes(f?.notes || ''); setFError('');
    setFactoryFormOpen(true);
  };
  const saveFactory = async () => {
    if (!fName.trim()) { setFError('Name is required.'); return; }
    setFSaving(true); setFError('');
    try {
      if (editFactory) await doUpdateFactory({ id: editFactory.id, name: fName, notes: fNotes || null });
      else await doCreateFactory({ name: fName, notes: fNotes || null });
      setFactoryFormOpen(false);
      reloadFactories();
    } catch (e: unknown) {
      setFError(e instanceof Error ? e.message : 'Failed to save factory');
    } finally { setFSaving(false); }
  };

  const openCatForm = (c: CategoryRow | null) => {
    setEditCategory(c); setCName(c?.name || ''); setCError('');
    setCatFormOpen(true);
  };
  const saveCategory = async () => {
    if (!cName.trim()) { setCError('Name is required.'); return; }
    setCSaving(true); setCError('');
    try {
      if (editCategory) {
        await doUpdateCategory({ id: editCategory.id, name: cName, is_active: editCategory.is_active });
      } else {
        const res = await doCreateCategory({ name: cName }) as unknown[];
        if (!res || res.length === 0) { setCError('A category with this name already exists.'); return; }
      }
      setCatFormOpen(false);
      reloadCategories();
    } catch (e: unknown) {
      setCError(e instanceof Error ? e.message : 'Failed to save category');
    } finally { setCSaving(false); }
  };

  const toggleCategoryActive = async (c: CategoryRow) => {
    await doUpdateCategory({ id: c.id, name: c.name, is_active: !c.is_active });
    reloadCategories();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true); setDeleteError('');
    try {
      const res = confirmDelete.kind === 'factory'
        ? await doDeleteFactory({ id: confirmDelete.id }) as unknown[]
        : await doDeleteCategory({ id: confirmDelete.id }) as unknown[];
      if (!res || res.length === 0) {
        setDeleteError(confirmDelete.kind === 'factory'
          ? 'This factory is referenced by products, batches, or shipments and cannot be deleted.'
          : 'Products use this category — reassign them first, or deactivate it instead.');
        return;
      }
      setConfirmDelete(null);
      if (confirmDelete.kind === 'factory') reloadFactories(); else reloadCategories();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Factories */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Factory className="h-4 w-4" /> Factories</CardTitle>
            <Button size="sm" onClick={() => openFactoryForm(null)} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Factory
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead className="text-center">Batches</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factoryList.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-sm">{f.name}</TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[280px] truncate" title={f.notes || ''}>{f.notes || '—'}</TableCell>
                  <TableCell className="text-center text-sm">{f.product_count}</TableCell>
                  <TableCell className="text-center text-sm">{f.batch_count}</TableCell>
                  <TableCell className="text-right pr-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit factory" onClick={() => openFactoryForm(f)}><Pencil className="h-3 w-3" /></Button>
                    {f.is_used ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}><Button size="icon" variant="ghost" className="h-7 w-7 text-gray-300" disabled><Trash2 className="h-3 w-3" /></Button></span>
                          </TooltipTrigger>
                          <TooltipContent>Referenced by products, batches, or shipments — cannot delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete factory" onClick={() => { setDeleteError(''); setConfirmDelete({ kind: 'factory', id: f.id, name: f.name }); }}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {factoryList.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400">No factories</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Categories */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Tags className="h-4 w-4" /> Product Categories</CardTitle>
            <Button size="sm" onClick={() => openCatForm(null)} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">In Use</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryList.map(c => (
                <TableRow key={c.id} className={!c.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium text-sm capitalize">{c.name}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{c.is_used ? 'Yes' : '—'}</TableCell>
                  <TableCell className="text-center"><Switch checked={!!c.is_active} onCheckedChange={() => toggleCategoryActive(c)} /></TableCell>
                  <TableCell className="text-right pr-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Rename category" onClick={() => openCatForm(c)}><Pencil className="h-3 w-3" /></Button>
                    {c.is_used ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}><Button size="icon" variant="ghost" className="h-7 w-7 text-gray-300" disabled><Trash2 className="h-3 w-3" /></Button></span>
                          </TooltipTrigger>
                          <TooltipContent>Products use this category — deactivate instead of deleting</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete category" onClick={() => { setDeleteError(''); setConfirmDelete({ kind: 'category', id: c.id, name: c.name }); }}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {categoryList.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400">No categories</TableCell></TableRow>}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground p-3">
            Renaming a category updates every product in it automatically. Inactive categories stay on existing products but disappear from the new-product picker.
          </p>
        </CardContent>
      </Card>

      {/* Add / Edit Factory */}
      <Dialog open={factoryFormOpen} onOpenChange={v => !v && setFactoryFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editFactory ? 'Edit Factory' : 'Add Factory'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Shenzhen PeptideLab Biotech Co., Ltd." /></div>
            <div><Label>Notes</Label><Textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={3} placeholder="Contact, certifications, lead times…" /></div>
            {fError && <p className="text-sm text-red-600">{fError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFactoryFormOpen(false)}>Cancel</Button>
            <Button onClick={saveFactory} disabled={fSaving}>{fSaving ? 'Saving…' : editFactory ? 'Save Changes' : 'Add Factory'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Rename Category */}
      <Dialog open={catFormOpen} onOpenChange={v => !v && setCatFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCategory ? 'Rename Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. capsule" />
              {editCategory?.is_used && <p className="text-xs text-muted-foreground mt-1">Renaming updates every product currently in “{editCategory.name}”.</p>}
            </div>
            {cError && <p className="text-sm text-red-600">{cError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatFormOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={cSaving}>{cSaving ? 'Saving…' : editCategory ? 'Save Changes' : 'Add Category'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={v => !v && !deleting && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {confirmDelete?.kind === 'factory' ? 'Factory' : 'Category'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <span className="font-medium text-foreground">{confirmDelete?.name}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
