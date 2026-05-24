import { useGetNotificationSettings, useUpdateNotificationSettings, getGetNotificationSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { data: settings, isLoading } = useGetNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleToggle = (key: keyof NonNullable<typeof settings>) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: !settings[key] };
    
    updateMutation.mutate({ data: newSettings }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetNotificationSettingsQueryKey(), newSettings);
        toast({ title: "Settings updated" });
      }
    });
  };

  const handleSelectChange = (value: string) => {
    if (!settings) return;
    const newSettings = { ...settings, digestTime: value };
    
    updateMutation.mutate({ data: newSettings }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetNotificationSettingsQueryKey(), newSettings);
        toast({ title: "Settings updated" });
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
        <h1 className="font-semibold">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Moon className="w-5 h-5 text-primary" /> Appearance
            </h2>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Theme</Label>
                    <p className="text-sm text-muted-foreground">Select your preferred interface theme.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={theme === 'light' ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => setTheme('light')}
                    >
                      <Sun className="w-4 h-4 mr-2" /> Light
                    </Button>
                    <Button 
                      variant={theme === 'dark' ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => setTheme('dark')}
                    >
                      <Moon className="w-4 h-4 mr-2" /> Dark
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Notifications
            </h2>
            
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : settings ? (
              <Card>
                <CardContent className="p-0 divide-y">
                  <div className="p-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Trial Reminders</Label>
                      <p className="text-sm text-muted-foreground">Receive reminders before your trial expires.</p>
                    </div>
                    <Switch checked={settings.trialReminders} onCheckedChange={() => handleToggle('trialReminders')} />
                  </div>
                  
                  <div className="p-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Priority Alerts</Label>
                      <p className="text-sm text-muted-foreground">Only notify me for messages Xan marks as High or Urgent.</p>
                    </div>
                    <Switch checked={settings.priorityAlerts} onCheckedChange={() => handleToggle('priorityAlerts')} />
                  </div>

                  <div className="p-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Daily Digest</Label>
                      <p className="text-sm text-muted-foreground">Receive a summary of missed messages.</p>
                    </div>
                    <Switch checked={settings.dailyDigest} onCheckedChange={() => handleToggle('dailyDigest')} />
                  </div>

                  {settings.dailyDigest && (
                    <div className="p-6 flex items-center justify-between bg-accent/10">
                      <Label className="text-base">Digest Time</Label>
                      <Select value={settings.digestTime} onValueChange={handleSelectChange}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="08:00">8:00 AM</SelectItem>
                          <SelectItem value="12:00">12:00 PM</SelectItem>
                          <SelectItem value="17:00">5:00 PM</SelectItem>
                          <SelectItem value="20:00">8:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Privacy & Security
            </h2>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Xanda Cross uses end-to-end encryption where supported by platforms. 
                  Xan AI models are hosted in a secure enclave and do not train on your personal data.
                </p>
                <Button variant="outline">View Privacy Policy</Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
