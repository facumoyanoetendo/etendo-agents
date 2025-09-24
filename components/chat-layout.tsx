
'use client'

import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SidebarConversations } from '@/components/conversation-history-content';
import ChatInterface from '@/components/chat-interface';
import { Agent } from '@/components/chat-interface';
import { User } from '@supabase/supabase-js';
import { Conversation } from '@/lib/actions/chat';
import { useMediaQuery } from '@/hooks/use-media-query';
import { GlobalHeader } from './global-header';

interface ChatLayoutProps {
  agent: Agent;
  user: User;
  conversationId?: string;
  initialMessages: any[];
  initialSessionId: string | null;
  initialConversations: Conversation[];
  agentPath: string;
  userRole: string | null;
}

export default function ChatLayout({ 
  agent, 
  user, 
  conversationId, 
  initialMessages, 
  initialSessionId, 
  initialConversations, 
  agentPath, 
  userRole 
}: ChatLayoutProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <div className="flex flex-col h-screen">
      <GlobalHeader 
        user={user} 
        userRole={userRole} 
        initialConversations={initialConversations} 
        agentPath={agentPath} 
        activeConversationId={conversationId} 
        agentId={agent.id} 
      />
      <div className="flex flex-1 overflow-hidden">
        {isDesktop ? (
          <SidebarProvider>
            <Sidebar>
              <SidebarConversations
                initialConversations={initialConversations}
                agentPath={agentPath}
                activeConversationId={conversationId}
                agentId={agent.id}
              />
            </Sidebar>
            <SidebarInset>
              <ChatInterface
                agent={agent}
                user={user}
                conversationId={conversationId}
                initialMessages={initialMessages}
                initialSessionId={initialSessionId}
              />
            </SidebarInset>
          </SidebarProvider>
        ) : (
          <ChatInterface
            agent={agent}
            user={user}
            conversationId={conversationId}
            initialMessages={initialMessages}
            initialSessionId={initialSessionId}
          />
        )}
      </div>
    </div>
  );
}
