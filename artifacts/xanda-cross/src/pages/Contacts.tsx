import { useState } from "react";
import { useGetContacts } from "@workspace/api-client-react";
import { PlatformIcon } from "@/components/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon, Users } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

function ContactAvatar({ name, src }: { name: string; src?: string | null }) {
  const colors = [
    "bg-violet-100 text-violet-600",
    "bg-blue-100 text-blue-600",
    "bg-emerald-100 text-emerald-600",
    "bg-rose-100 text-rose-600",
    "bg-amber-100 text-amber-600",
    "bg-cyan-100 text-cyan-600",
  ];
  const idx = name.charCodeAt(0) % colors.length;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-12 h-12 rounded-full object-cover shrink-0 shadow-sm"
      />
    );
  }
  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${colors[idx]}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetContacts({ search: search || undefined });

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-5"
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl rounded-2xl px-5 py-3.5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-white/70 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <SearchIcon className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
          />
        </div>

        {/* Contact grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 rounded-3xl" />
            ))}
          </div>
        ) : data?.contacts && data.contacts.length > 0 ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.05 } },
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {(data.contacts as any[]).map((contact) => (
                <motion.div
                  key={contact.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                  }}
                  whileHover={{ y: -3 }}
                >
                  <Link href={`/contacts/${contact.id}`}>
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/70 shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-5 cursor-pointer hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-all duration-200 flex items-center gap-4 group">
                      <ContactAvatar name={contact.displayName} src={contact.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm">
                          {contact.displayName}
                        </h3>
                        <div className="flex gap-1.5 mt-1.5">
                          {(contact.platforms as string[]).map((p) => (
                            <PlatformIcon key={p} platform={p} className="w-3.5 h-3.5" />
                          ))}
                        </div>
                      </div>
                      <div className="text-center shrink-0">
                        <div className="text-lg font-bold text-gray-900">
                          {contact.activeConversationCount}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium">Chats</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/70 p-16 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-500">
              {search ? `No contacts matching "${search}"` : "No contacts yet"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Contacts appear here as you sync messages
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
