## (*'-')/.zshenv

umask 022

if [ -z $USER ]
    then
    export USER=$LOGNAME
fi

export LANG=ja_JP.UTF-8
export LANGUAGE=ja
export EDITOR=vi
export PAGER=less
export BLOCKSIZE=K
export PERL_BADLANG=0
export PGPPATH=$HOME/.pgp
export NETHACKOPTIONS="noautopickup"
export GREP_COLOR="01;34"
export GREP_OPTIONS="--color=auto"
export LV='-Ou8 -c'
export TZ='JST-9'
export GISTY_DIR=$HOME/wc/gists
export DISABLE_AUTO_TITLE=true
#export GST_TAG_ENCODING=CP932
#export GST_ID3_TAG_ENCODING=CP932
if [ -x /usr/share/source-highlight/src-hilite-lesspipe.sh ]
    then
    export LESS='-R'
    export LESSOPEN='| /usr/share/source-highlight/src-hilite-lesspipe.sh %s'
fi
export GOPATH=$HOME/.go
export PATH=$HOME/bin:$HOME/opt/bin:$PATH:$GOPATH/bin

case "$OSTYPE" in
    cygwin)
        export CYGWIN=acl
        ;;
    *)
        limit coredumpsize 0
        ;;
esac

if [ -e $HOME/.zshenv.local ]; then
    source $HOME/.zshenv.local
fi
