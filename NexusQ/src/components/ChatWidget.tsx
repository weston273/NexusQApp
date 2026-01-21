import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, Bot, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Message {
  id: string;
  type: 'bot' | 'user';
  text: string;
  options?: string[];
  isComplete?: boolean;
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  type: 'bot',
  text: "Hi! I'm Nexus Q, your home service assistant. How can I help you today?",
  options: ['Request Service', 'Pricing Info', 'Emergency Help']
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState(0);
  const [leadData, setLeadData] = useState({
    service: '',
    name: '',
    contact: ''
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleOptionClick = (option: string) => {
    addMessage({
      id: Date.now().toString(),
      type: 'user',
      text: option
    });

    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      if (option === 'Request Service') {
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: "Excellent. Which service do you need?",
          options: ['HVAC Repair', 'Plumbing', 'Electrical', 'General Maintenance']
        });
        setStep(1);
      } else if (step === 1) {
        setLeadData(prev => ({ ...prev, service: option }));
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: "Got it. May I have your name, please?"
        });
        setStep(2);
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: "I've noted that. How else can I help?"
        });
      }
    }, 1000);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue('');

    addMessage({
      id: Date.now().toString(),
      type: 'user',
      text: userText
    });

    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      if (step === 2) {
        setLeadData(prev => ({ ...prev, name: userText }));
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: `Thanks, ${userText}. What's the best phone number or email to reach you?`
        });
        setStep(3);
      } else if (step === 3) {
        setLeadData(prev => ({ ...prev, contact: userText }));
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: "Perfect! I've captured your request. A team member will contact you shortly to confirm the details. (Demo Mode: No real message sent)",
          isComplete: true
        });
        
        console.log("MOCK EVENT: lead_captured", {
          service: leadData.service,
          name: leadData.name,
          contact: userText
        });

        toast.success('Lead Captured Successfully!', {
          description: `${leadData.service} request from ${leadData.name}`,
        });
        
        setStep(4);
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: "I understand. I'll pass that along to the team."
        });
      }
    }, 1000);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 z-50",
          isOpen ? "rotate-90 bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </Button>

      <div className={cn(
        "fixed bottom-24 right-6 w-[380px] h-[520px] bg-card border rounded-2xl shadow-2xl flex flex-col transition-all duration-300 transform z-50 overflow-hidden",
        isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4 pointer-events-none"
      )}>
        <div className="p-4 bg-primary text-primary-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold leading-none">Nexus Q</h3>
            <span className="text-xs text-primary-foreground/70">Online · Home Service Expert</span>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 p-4 space-y-4 overflow-y-auto bg-secondary/10"
        >
          {messages.map((m) => (
            <div 
              key={m.id}
              className={cn(
                "flex gap-3 animate-fade-in",
                m.type === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                m.type === 'bot' ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              )}>
                {m.type === 'bot' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="flex flex-col gap-2 max-w-[80%]">
                <div className={cn(
                  "p-3 text-sm rounded-2xl",
                  m.type === 'bot' 
                    ? "bg-card border rounded-tl-none shadow-sm" 
                    : "bg-primary text-primary-foreground rounded-tr-none"
                )}>
                  {m.text}
                </div>
                {m.options && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {m.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleOptionClick(opt)}
                        className="px-3 py-1 text-xs font-medium border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {m.isComplete && (
                  <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400 mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Request Successfully Captured
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-card border rounded-2xl rounded-tl-none flex gap-1 items-center">
                <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={!inputValue.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Nexus Q Demo Mode · No data is stored
          </p>
        </div>
      </div>
    </>
  );
};
