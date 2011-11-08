## (*'-')/.zlogin
#test -x /usr/bin/screen && /usr/bin/screen -U -xR
if [ -e $HOME/.zlogin.local ]; then
    source $HOME/.zlogin.local
fi
true
