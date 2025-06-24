## -*- mode: sh; coding: utf-8-unix -*-

umask 022

if [ -z "${USER:-}" ]; then
    export USER=$LOGNAME
fi

export LANG=ja_JP.UTF-8
export LANGUAGE=ja
export EDITOR=vim
export PAGER=less
export PERL_BADLANG=0
export PGPPATH=$HOME/.pgp
export NETHACKOPTIONS="noautopickup"
export LV='-Ou8 -c'
export TZ='JST-9'
export GISTY_DIR=$HOME/wc/gists
export DISABLE_AUTO_TITLE=true

export GOPATH=$HOME/.go
export PATH="$HOME/opt/global/bin:$HOME/bin:$HOME/.local/bin:$GOPATH/bin:$PATH"

if command -v java >/dev/null 2>&1; then
    export JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"
fi

# less with source-highlight
if [ -x /usr/share/source-highlight/src-hilite-lesspipe.sh ]; then
    export LESS='-R -j5 --no-init'
    export LESSOPEN='| /usr/share/source-highlight/src-hilite-lesspipe.sh %s'
fi

# Platform-dependent
case "$OSTYPE" in
  cygwin)
    export CYGWIN=acl
    ;;
  *)
    limit coredumpsize 0  # zshに限る。shでは動かない
    ;;
esac

# local extension
[ -e "$HOME/.zshenv.local" ] && source "$HOME/.zshenv.local"
