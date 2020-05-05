## -*- mode: sh; coding: utf-8-unix -*-

if [ -e $HOME/.zlogin.local ]; then
    source $HOME/.zlogin.local
fi

# Start tmux
if ! isemacs && ! istmux && ! isscreen && ! isdumb && which tmux > /dev/null; then
    ID=`tmux ls | grep -vm1 attached | cut -d: -f1`
    if [[ -z "$ID" ]]; then
        tmux new-session
    else
        tmux attach-session -t $ID
    fi
fi
