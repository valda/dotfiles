## (*'-')/.zlogout

if [ -x /usr/bin/ssh-agent -a -n "$SSH_AGENT_PID" ]
then
    ssh-agent -k
fi

