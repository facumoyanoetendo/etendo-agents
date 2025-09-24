

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Conversation } from "@/lib/actions/chat";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusIcon, Loader2, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { fetchConversations } from '@/lib/actions/conversations';
import { deleteConversation } from '@/lib/actions/deleteConversation';
import { updateConversationTitle } from '@/lib/actions/updateConversationTitle';
import { useToast } from "@/components/ui/use-toast";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface ConversationHistoryContentProps {
  initialConversations: Conversation[];
  agentPath: string;
  activeConversationId?: string;
  agentId: string;
}

export function ConversationHistoryContent({ initialConversations, agentPath, activeConversationId, agentId }: ConversationHistoryContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [conversations, setConversations] = useState(initialConversations);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialConversations.length === 10);

  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [conversationToEdit, setConversationToEdit] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const observer = useRef<IntersectionObserver>();
  const lastConversationElementRef = useCallback((node: HTMLLIElement | null) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      } 
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);

  useEffect(() => {
    if (activeConversationId === undefined) {
      const hasNewChat = conversations.some(c => c._id === 'new-chat');
      if (!hasNewChat) {
        setConversations(prev => [
          {
            _id: 'new-chat',
            conversationTitle: 'New chat',
            agentId: '',
            sessionId: '',
            email: '',
            createdAt: new Date(),
            updatedAt: new Date()
          } as Conversation,
          ...prev
        ]);
      }
    }
  }, [activeConversationId, conversations]);

  // Effect for searching
  useEffect(() => {
    setConversations([]);
    setPage(1);
    setHasMore(true);
    setIsLoading(true);

    fetchConversations(agentId, { searchTerm: debouncedSearchTerm, page: 1, limit: 10 }).then(newConversations => {
      setConversations(newConversations);
      setHasMore(newConversations.length === 10);
      setIsLoading(false);
    });

  }, [debouncedSearchTerm, agentId]);

  // Effect for pagination
  useEffect(() => {
    if (page === 1) return;
    setIsLoading(true);
    fetchConversations(agentId, { searchTerm: debouncedSearchTerm, page, limit: 10 }).then(newConversations => {
      setConversations(prev => [...prev, ...newConversations]);
      setHasMore(newConversations.length === 10);
      setIsLoading(false);
    });
  }, [page, debouncedSearchTerm, agentId]);

  const handleDelete = async () => {
    if (!conversationToDelete) return;
    setIsDeleting(true);
    const result = await deleteConversation(conversationToDelete._id);
    setIsDeleting(false);

    if (result.success) {
      setConversations(prev => prev.filter(c => c._id !== conversationToDelete._id));
      toast({ title: "Success", description: "Conversation deleted." });
      setIsDeleteDialogOpen(false);
      if (activeConversationId === conversationToDelete._id) {
        router.push(`/chat/${agentPath}`);
      }
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const handleUpdateTitle = async () => {
    if (!conversationToEdit || !newTitle.trim()) return;
    setIsUpdating(true);
    const result = await updateConversationTitle(conversationToEdit._id, newTitle);
    setIsUpdating(false);

    if (result.success) {
      setConversations(prev => prev.map(c => c._id === conversationToEdit._id ? { ...c, conversationTitle: newTitle } : c));
      toast({ title: "Success", description: "Title updated." });
      setIsEditDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  return (
    <SidebarContent>
      <div className="p-2 mt-24">
        <Link href={`/chat/${agentPath}`} className="w-full">
          <Button className="w-full justify-start">
            <PlusIcon className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </Link>
      </div>
      <div className="p-2">
        <Input
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className=''
        />
      </div>
      <SidebarGroup>
        <SidebarGroupLabel className="text-2xl py-4 border-b border-gray-300">History</SidebarGroupLabel>
        <SidebarGroupContent className="pt-4">
          <SidebarMenu>
            {conversations.map((item, index) => {
              const cleanedTitle = item.conversationTitle
                ? item.conversationTitle.replace(/(\n\nUser email:.*|\n\nFilesAttached:.*)/gs, "").trim()
                : "New Chat";

              const isActive = item._id === activeConversationId || (item._id === 'new-chat' && activeConversationId === undefined);
              const isLastElement = conversations.length === index + 1;

              return (
                <SidebarMenuItem ref={isLastElement ? lastConversationElementRef : null} key={item._id}>
                  <div className="flex items-center justify-between w-full group">
                    <SidebarMenuButton asChild className={`${isActive ? "bg-gray-300 hover:bg-gray-200" : "hover:bg-gray-200"} flex-1 w-0`}>
                      <Link href={item._id === 'new-chat' ? `/chat/${agentPath}` : `/chat/${agentPath}/${item._id}`} className="truncate">
                        <span>{cleanedTitle}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item._id !== 'new-chat' && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </span>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1">
                          <div className="grid gap-1">
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-sm p-2"
                              onClick={() => {
                                setConversationToEdit(item);
                                setNewTitle(item.conversationTitle);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Cambiar nombre
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-sm p-2 text-red-500 hover:text-red-600 focus:text-red-600"
                              onClick={() => {
                                setConversationToDelete(item);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </SidebarMenuItem>
              );
            })}
            {isLoading && (
              <div className="flex justify-center items-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Title Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit conversation title</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new title"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateTitle} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarContent>
  )
}